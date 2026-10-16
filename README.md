# FIT3179-DV2

Each folder in `diagrams/` contains a diagram's Vega-Lite specification and the datasets it plots.

```text
index.html
script.js
style.css
diagrams/
  top10_dogs_lollipop/
    dog_chart.json
    top10_dogs.csv
  group_registrations_heatmap/
    registration_heatmap.json
    group_registrations.csv
  casey_dogs_proportional_symbol_map/
    dog_map.json
    casey_suburbs.geojson
    dogs_by_suburb.json
  townsville_breeds_bump/
    townsville_bump.json
    townsville_breed_ranks.json
  townsville_breed_changes_connected_dot/
    townsville_connected_dots.json
    townsville_breed_changes.json
  townsville_dog_decline_choropleth/
    townsville_decline_map.json
    townsville_dog_decline.geojson
```

Open `index.html` through a local web server (such as VS Code Live Server) with the project root as the server directory. Chart and dataset URLs are relative to the root page.
