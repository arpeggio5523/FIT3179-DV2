async function renderChart(selector, specUrl) {
  const container = document.querySelector(selector);
  if (!container) {
    console.error(`Chart container not found: ${selector}`);
    return;
  }
  container.textContent = "Loading chart…";
  container.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(specUrl);
    if (!response.ok) throw new Error(`Could not load ${specUrl}`);
    const spec = await response.json();

    // Fetch the data explicitly so a missing CSV cannot render an empty chart.
    const dataResponse = await fetch(spec.data.url);
    if (!dataResponse.ok) throw new Error(`Could not load ${spec.data.url}`);
    const csv = (await dataResponse.text()).replace(/^\uFEFF/, "");
    const rows = vega.read(csv, { type: "csv" });
    const requiredFields = selector === "#breed-chart"
      ? ["Breed", "Count"]
      : ["Group", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"];
    if (!rows.length || requiredFields.some(field => !(field in rows[0]))) {
      throw new Error(`Missing or invalid data in ${spec.data.url}`);
    }
    // Rows are already decoded; only preserve field parsing, not the CSV type.
    spec.data = {
      values: rows,
      format: { type: "json", parse: spec.data.format?.parse || {} }
    };
    spec.width = "container";
    spec.autosize = { type: "fit-x", contains: "padding", resize: true };

    container.textContent = "";
    await vegaEmbed(container, spec, { actions: false });
  } catch (error) {
    console.error(error);
    container.classList.add("chart-error");
    container.textContent = `${error.message}. Make sure the file is in the project folder and open the page through a local web server (such as Live Server).`;
    if (selector === "#registration-heatmap") {
      const summary = document.querySelector("#registration-summary");
      if (summary) summary.hidden = true;
    }
  } finally {
    container.setAttribute("aria-busy", "false");
  }
}

renderChart("#breed-chart", "diagrams/top10_dogs_lollipop/dog_chart.json");
renderChart("#registration-heatmap", "diagrams/group_registrations_heatmap/registration_heatmap.json");


vegaEmbed("#dog-map", "diagrams/casey_dogs_proportional_symbol_map/dog_map.json")
  .catch(console.error);

vegaEmbed("#townsville-bump", "diagrams/townsville_breeds_bump/townsville_bump.json")
  .catch(console.error);

vegaEmbed(
  "#townsville-connected-dots",
  "diagrams/townsville_breed_changes_connected_dot/townsville_connected_dots.json"
).catch(console.error);

vegaEmbed(
  "#townsville-decline-map",
  "diagrams/townsville_dog_decline_choropleth/townsville_decline_map.json"
).catch(console.error);