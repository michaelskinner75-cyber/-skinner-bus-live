# Skinner Bus Live

Independent, mobile-first Stagecoach East Scotland bus information website covering Fife, Dundee, Perth, Angus, St Andrews and Stagecoach services into Edinburgh.

## Current version

This first release contains:

- Responsive phone and desktop design
- Area filters
- Stop, town and service search
- Departure cards with live/scheduled labels
- Fleet-number field
- Favourite departures stored on the device
- Dark mode
- Location permission demo

The displayed departures are demonstration records until the production data backend is connected.

## Data plan

- NPTG: places
- NaPTAN: stops and coordinates
- NOC: operator identity and codes
- TNDS / Traveline Scotland TransXChange: scheduled timetables
- Authorised SIRI or GTFS-RT source: live vehicle positions and delays
- bustimes.org API: optional contributed vehicle information

Do not scrape bustimes.org pages. Use licensed/open datasets and documented APIs.

## GitHub Pages

Publish from the `main` branch and `/ (root)` folder in **Settings → Pages**.

## Disclaimer

This is an independent project and is not affiliated with or endorsed by Stagecoach.
