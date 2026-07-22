#!/usr/bin/env python3
"""Download Stagecoach East Scotland TXC and build Edinburgh scheduled departures."""
from __future__ import annotations

import datetime as dt
import io
import json
import re
import urllib.request
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

URL = "https://opendata.stagecoachbus.com/stagecoach-scfi-route-schedule-data-transxchange_2_4.zip"
OUT = Path("data/edinburgh-scheduled.json")
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def children(node, name):
    return [x for x in node.iter() if local(x.tag) == name]


def first(node, name, default=""):
    for x in node.iter():
        if local(x.tag) == name and x.text:
            return x.text.strip()
    return default


def direct(node, name, default=""):
    for x in list(node):
        if local(x.tag) == name and x.text:
            return x.text.strip()
    return default


def duration_seconds(value: str) -> int:
    if not value:
        return 0
    m = re.fullmatch(r"P(?:([0-9]+)D)?T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?", value)
    if not m:
        return 0
    d, h, mi, s = (int(v or 0) for v in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def add_time(value: str, seconds: int) -> str:
    h, m, *rest = [int(x) for x in value.split(":")]
    s = rest[0] if rest else 0
    total = h * 3600 + m * 60 + s + seconds
    return f"{(total // 3600) % 24:02d}:{(total // 60) % 60:02d}"


def operating_days(profile) -> list[str]:
    if profile is None:
        return DAY_NAMES.copy()
    names = set()
    for node in profile.iter():
        tag = local(node.tag)
        if tag in DAY_NAMES:
            names.add(tag)
        elif tag == "MondayToFriday":
            names.update(DAY_NAMES[:5])
        elif tag == "MondayToSaturday":
            names.update(DAY_NAMES[:6])
        elif tag == "Weekend":
            names.update(DAY_NAMES[5:])
        elif tag == "NotSaturday":
            names.update([*DAY_NAMES[:5], DAY_NAMES[6]])
        elif tag == "NotSunday":
            names.update(DAY_NAMES[:6])
    return [d for d in DAY_NAMES if d in names] or DAY_NAMES.copy()


def load_documents() -> list[ET.Element]:
    request = urllib.request.Request(URL, headers={"User-Agent": "SkinnerBusLive/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = response.read()
    roots = []
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        for name in archive.namelist():
            if name.lower().endswith(".xml"):
                try:
                    roots.append(ET.fromstring(archive.read(name)))
                except ET.ParseError:
                    continue
    if not roots:
        raise RuntimeError("No readable TransXChange XML files found")
    return roots


def parse():
    departures = []
    files_read = 0
    for root in load_documents():
        files_read += 1
        stops = {}
        for point in children(root, "AnnotatedStopPointRef"):
            ref = first(point, "StopPointRef")
            if not ref:
                continue
            common = first(point, "CommonName")
            locality = first(point, "LocalityName")
            indicator = first(point, "Indicator") or first(point, "ShortCommonName")
            stops[ref] = {"common": common, "locality": locality, "indicator": indicator}

        # Some TXC files contain full StopPoint definitions instead.
        for point in children(root, "StopPoint"):
            ref = point.attrib.get("id") or first(point, "AtcoCode")
            if ref and ref not in stops:
                stops[ref] = {
                    "common": first(point, "CommonName"),
                    "locality": first(point, "LocalityName"),
                    "indicator": first(point, "Indicator") or first(point, "ShortCommonName"),
                }

        sections = {}
        for section in children(root, "JourneyPatternSection"):
            sid = section.attrib.get("id")
            links = []
            for link in list(section):
                if local(link.tag) != "JourneyPatternTimingLink":
                    continue
                from_node = next((x for x in list(link) if local(x.tag) == "From"), None)
                to_node = next((x for x in list(link) if local(x.tag) == "To"), None)
                if from_node is None or to_node is None:
                    continue
                links.append({
                    "from": first(from_node, "StopPointRef"),
                    "to": first(to_node, "StopPointRef"),
                    "run": duration_seconds(first(link, "RunTime")),
                    "from_wait": duration_seconds(first(from_node, "WaitTime")),
                    "to_wait": duration_seconds(first(to_node, "WaitTime")),
                })
            if sid:
                sections[sid] = links

        patterns = {}
        services = {}
        line_names = {}
        for service in children(root, "Service"):
            service_id = service.attrib.get("id") or direct(service, "ServiceCode")
            service_profile = next((x for x in list(service) if local(x.tag) == "OperatingProfile"), None)
            service_days = operating_days(service_profile)
            for line in children(service, "Line"):
                lid = line.attrib.get("id")
                if lid:
                    line_names[lid] = first(line, "LineName") or first(line, "LineDescription")
            for pattern in children(service, "JourneyPattern"):
                pid = pattern.attrib.get("id")
                section_refs = []
                refs_text = first(pattern, "JourneyPatternSectionRefs")
                if refs_text:
                    section_refs.extend(refs_text.split())
                for refnode in children(pattern, "JourneyPatternSectionRef"):
                    if refnode.text:
                        section_refs.append(refnode.text.strip())
                destination = first(pattern, "DestinationDisplay")
                destination_ref = first(pattern, "Destination")
                if not destination and destination_ref in stops:
                    destination = stops[destination_ref]["common"]
                patterns[pid] = {
                    "sections": section_refs,
                    "destination": destination,
                    "direction": first(pattern, "Direction"),
                }
            if service_id:
                services[service_id] = {"days": service_days}

        vjs = {}
        for vj in children(root, "VehicleJourney"):
            vid = vj.attrib.get("id") or first(vj, "VehicleJourneyCode")
            if not vid:
                continue
            profile = next((x for x in list(vj) if local(x.tag) == "OperatingProfile"), None)
            vjs[vid] = {
                "parent": direct(vj, "VehicleJourneyRef"),
                "service": direct(vj, "ServiceRef"),
                "line": direct(vj, "LineRef"),
                "pattern": direct(vj, "JourneyPatternRef"),
                "departure": direct(vj, "DepartureTime"),
                "profile": profile,
            }

        def resolved(vid, seen=None):
            seen = seen or set()
            if vid in seen or vid not in vjs:
                return {}
            seen.add(vid)
            item = vjs[vid]
            base = resolved(item["parent"], seen) if item["parent"] else {}
            return {k: item[k] or base.get(k) for k in ("service", "line", "pattern", "departure", "profile")}

        for vid in vjs:
            item = resolved(vid)
            pattern = patterns.get(item.get("pattern"))
            departure_time = item.get("departure")
            if not pattern or not departure_time:
                continue
            elapsed = 0
            visited = set()
            for section_ref in pattern["sections"]:
                for link in sections.get(section_ref, []):
                    from_ref = link["from"]
                    if from_ref and from_ref not in visited:
                        visited.add(from_ref)
                        stop = stops.get(from_ref, {})
                        text = f"{stop.get('common','')} {stop.get('locality','')}".lower()
                        if "edinburgh" in text and "bus station" in text:
                            indicator = stop.get("indicator", "")
                            m = re.search(r"(?:stance|stand|bay)?\s*([0-9]{1,2}[a-z]?)", indicator, re.I)
                            stance = m.group(1).upper() if m else (indicator or "—")
                            days = operating_days(item.get("profile")) if item.get("profile") is not None else services.get(item.get("service"), {}).get("days", DAY_NAMES)
                            departures.append({
                                "time": add_time(departure_time, elapsed),
                                "route": line_names.get(item.get("line"), "Bus"),
                                "destination": pattern.get("destination") or "See timetable",
                                "via": "Scheduled service",
                                "operator": "Stagecoach East Scotland",
                                "stance": stance,
                                "days": days,
                            })
                    elapsed += link["from_wait"] + link["run"] + link["to_wait"]

            # Include Edinburgh if it is the final stop in a pattern.
            if pattern["sections"]:
                links = sections.get(pattern["sections"][-1], [])
                if links:
                    stop = stops.get(links[-1]["to"], {})
                    text = f"{stop.get('common','')} {stop.get('locality','')}".lower()
                    # Arrivals are deliberately not shown as departures.

    unique = {}
    for item in departures:
        key = (item["time"], item["route"], item["destination"], item["stance"], tuple(item["days"]))
        unique[key] = item
    result = sorted(unique.values(), key=lambda x: (x["time"], x["route"], x["stance"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "source": URL,
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(),
        "filesRead": files_read,
        "departures": result,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(result)} Edinburgh departures from {files_read} TXC files")


if __name__ == "__main__":
    parse()
