/* Presentation layer: existing chart data and JSON files are preserved.
   This file replaces the three older script tags in index.html. */
(async function () {
  'use strict';
  const BODY = 'Source Sans 3';
  const TITLE = 'Source Serif 4';
  const palette = ['#0072B2', '#B86B00', '#944D88', '#56B4E9', '#51565D', '#6044A0'];
  const shapes = ['circle', 'square', 'diamond', 'triangle-up', 'triangle-down', 'cross'];
  const views = new Map();
  const cache = new Map();
  async function read(url, type = 'json') {
    const key = `${type}:${url}`;
    if (!cache.has(key)) cache.set(key, fetch(url).then(r => {
      if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`);
      return type === 'json' ? r.json() : r.text();
    }).catch(e => { cache.delete(key); throw e; }));
    return cache.get(key);
  }
  // Wait for font metrics before Vega lays out axes and labels.
  if (document.fonts) await Promise.all([
    document.fonts.load('400 14px "Source Sans 3"'),
    document.fonts.load('600 20px "Source Serif 4"')
  ]).catch(() => {});
  if (typeof vegaEmbed === 'undefined') {
    document.querySelectorAll('.chart-scroll').forEach(el => {
      el.textContent = 'Charts could not load. Check your connection and reload the page.';
      el.classList.add('chart-error');
    });
    return;
  }
  function walk(value, fn) {
    if (!value || typeof value !== 'object') return;
    fn(value);
    Object.values(value).forEach(v => Array.isArray(v) ? v.forEach(x => walk(x, fn)) : walk(v, fn));
  }
  function theme(spec) {
    // Explicit font settings inside a JSON mark override config, so update both.
    walk(spec, obj => {
      for (const key of ['font', 'labelFont', 'titleFont']) {
        if (typeof obj[key] === 'string') obj[key] = BODY;
        else if (obj[key]?.value) obj[key].value = BODY;
      }
      for (const key of ['fontSize', 'labelFontSize', 'titleFontSize']) {
        if (typeof obj[key] === 'number') obj[key] = Math.max(13, obj[key]);
        else if (typeof obj[key]?.value === 'number') obj[key].value = Math.max(13, obj[key].value);
      }
      if (obj.lineHeight?.value) obj.lineHeight.value = Math.max(16, obj.lineHeight.value);
    });
    const old = spec.config || {};
    spec.config = {
      ...old, background: '#ffffff',
      title: { ...old.title, font: TITLE, subtitleFont: BODY, fontSize: 18, subtitleFontSize: 14, anchor: 'start', color: '#172c40' },
      axis: { ...old.axis, labelFont: BODY, titleFont: BODY, labelFontSize: 13, titleFontSize: 14,
        labelColor: '#405466', titleColor: '#405466', titleFontWeight: 600, labelPadding: 7,
        titlePadding: 12, gridColor: '#e7edf2', domainColor: '#c5d0da', tickColor: '#c5d0da' },
      legend: { ...old.legend, labelFont: BODY, titleFont: BODY, labelFontSize: 13, titleFontSize: 13,
        titleFontWeight: 600, labelColor: '#405466', titleColor: '#405466', padding: 8 },
      text: { ...old.text, font: BODY, fontSize: 13 }
    };
    if (spec.$schema.includes('vega-lite')) {
      spec.config.font = BODY;
      spec.config.view = { stroke: null };
    }
    return spec;
  }
  function styleSpec(spec, id, available) {
    theme(spec);
    const isLite = spec.$schema.includes('vega-lite');
    if (id !== 'townsville-dot-map' && id !== 'sa-ownership-map') delete spec.title;
    let width = available;
    if (id === 'townsville-bump') width = Math.max(850, available);
    if (['breed-chart', 'townsville-connected-dots', 'registration-heatmap'].includes(id)) width = Math.max(540, available);
    if (id === 'rspca-sankey') width = Math.max(660, available);
    if (id === 'dog-map') width = Math.max(380, available);
    if (spec.vconcat) {
      const panels = spec.vconcat;
      delete spec.vconcat;
      const sideBySide = available >= 760;
      const panelWidth = sideBySide ? Math.floor((available - 36) / 2) : Math.max(280, available - 16);
      panels.forEach((p, i) => {
        p.width = panelWidth;
        // Centre each enlarged view on its own region. Distinct rotations also
        // prevent Vega-Lite from merging its projection with the overview.
        if (i === 1) p.projection.rotate = id === 'townsville-dot-map'
          ? [-146.75, 19.3, 0] : [-138.6, 34.9, 0];
        p.height = sideBySide ? 400 : (i === 0 ? 360 : 300);
        p.title = { text: i === 0 ? (id === 'townsville-dot-map' ? 'Townsville divisions' : 'South Australia') :
          (id === 'townsville-dot-map' ? 'Enlarged view · divisions 5–9' : 'Enlarged view · Adelaide'), font: TITLE, fontSize: 18, anchor: 'start' };
      });
      spec[sideBySide ? 'hconcat' : 'vconcat'] = panels;
      spec.spacing = 28;
      spec.bounds = 'flush';
      spec.config.legend.gradientLength = Math.min(260, panelWidth - 20);
      return spec;
    }
    spec.width = width;
    if (isLite) spec.autosize = { type: 'fit-x', contains: 'padding', resize: true };
    if (id === 'breed-chart') {
      spec.height = { step: 36 };
      spec.encoding.y.axis.labelFontSize = 13;
      spec.encoding.x.axis.tickCount = 4;
    }
    if (id === 'dog-map') {
      spec.height = 430;
      walk(spec, obj => { if (obj.legend) obj.legend.orient = 'bottom'; });
    }
    if (id === 'registration-heatmap') {
      spec.height = 300;
      // Values reinforce the diverging colour scale, including in greyscale.
      const rect = spec.mark;
      delete spec.mark;
      spec.layer = [{ mark: rect }, { mark: { type: 'text', font: BODY, fontSize: 12 }, encoding: {
        text: { field: 'Change', type: 'quantitative', format: '+.0%' },
        color: { condition: { test: 'abs(datum.Change) > 0.38', value: '#ffffff' }, value: '#24384a' }
      } }];
    }
    if (id === 'townsville-bump') {
      // Allocate a dedicated right-hand gutter for direct endpoint labels.
      spec.width = width - 300;
      spec.height = 630;
      spec.padding = { left: 5, top: 12, right: 290, bottom: 5 };
      spec.autosize = { type: 'none', contains: 'content' };
      spec.encoding.y.title = 'Rank · 1 is highest';
      walk(spec, obj => {
        if (obj.scale?.domain?.[0] === 'Maltese Terrier Cross') obj.scale.range = palette;
      });
      const points = spec.layer[3];
      points.encoding.shape = { field: 'Breed', type: 'nominal',
        scale: { domain: points.encoding.color.scale.domain, range: shapes }, legend: null };
      points.mark.size = 95;
      const labels = spec.layer[4];
      labels.mark.fontSize = 13;
      labels.mark.dy = { expr: "datum.Breed === 'Dachshund' ? -5 : datum.Breed === 'Miniature Dachshund' ? 5 : 0" };
    }
    if (id === 'townsville-connected-dots') {
      spec.height = { step: 52 };
      spec.layer[1].encoding.color.scale.range = ['#B86B00', '#0072B2'];
      spec.layer[1].encoding.shape = { field: 'YearLabel', type: 'nominal',
        scale: { domain: ['March 2023', 'March 2026'], range: ['circle', 'diamond'] }, legend: null };
    }
    if (id === 'dog-size-waffle') {
      spec.height = width < 580 ? Math.min(310, width - 4) + 208 : 355;
      spec.scales[0].range = ['#17658F', '#7EA8C4', '#D39A45'];
    }
    if (id === 'council-breed-treemap') {
      spec.height = 440;
      spec.legends[0].title = 'Councils listing the breed in their top five';
      spec.legends[0].titleLimit = Math.max(220, width - 25);
    }
    if (id === 'rspca-sankey') {
      spec.height = 550;
      spec.scales.find(s => s.name === 'outcomeColor').range =
        ['#17658F', '#72A7CC', '#B87722', '#8364A9', '#C5A253', '#535D70', '#B5BAC2'];
      // Wider labels are needed for the enlarged sans-serif text.
      spec.signals.find(s => s.name === 'targetX').update = 'width - 192';
    }
    return spec;
  }
  async function hydrate(spec) {
    const pending = [];
    walk(spec, obj => {
      if (typeof obj.url === 'string' && !obj.url.includes('{')) pending.push((async () => {
        const isCSV = obj.format?.type === 'csv' || /\.csv(?:\?|$)/.test(obj.url);
        const raw = await read(obj.url, isCSV ? 'text' : 'json');
        obj.values = isCSV ? vega.read(raw.replace(/^\uFEFF/, ''), { type: 'csv' }) : raw;
        delete obj.url;
        if (isCSV) obj.format = { type: 'json', parse: obj.format?.parse || {} };
      })());
    });
    await Promise.all(pending);
  }
  async function render(id, source) {
    const host = document.getElementById(id);
    if (!host) return;
    const viewport = host.closest('.chart-scroll');
    host.setAttribute('aria-busy', 'true');
    host.textContent = 'Loading chart…';
    try {
      const base = typeof source === 'string' ? await read(source) : await source();
      await hydrate(base);
      let previousWidth = 0;
      let timer;
      let drawing = false;
      let rerun = false;
      async function draw() {
        if (drawing) { rerun = true; return; }
        const width = Math.floor(viewport.clientWidth);
        if (width === previousWidth || width < 1) return;
        drawing = true;
        try {
          previousWidth = width;
          const old = views.get(id);
          const signalName = id === 'rspca-sankey' ? 'focusState' : id === 'dog-size-waffle' ? 'focusSize' : null;
          const selected = old && signalName ? old.signal(signalName) : 'All';
          if (old) old.finalize();
          const spec = styleSpec(structuredClone(base), id, width);
          if (signalName) spec.signals.find(s => s.name === signalName).value = selected;
          host.textContent = '';
          const result = await vegaEmbed(host, spec, { actions: false, renderer: 'svg' });
          views.set(id, result.view);
          host.classList.remove('chart-error');
        } finally {
          drawing = false;
          if (rerun) { rerun = false; await draw(); }
        }
      }
      await draw();
      new ResizeObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => draw().catch(showError), 160);
      }).observe(viewport);
      return views.get(id);
    } catch (error) { showError(error); }
    finally { host.setAttribute('aria-busy', 'false'); }
    function showError(error) {
      console.error(id, error);
      host.classList.add('chart-error');
      host.textContent = `This chart could not load. ${error.message}. Open the project with Live Server and check your connection.`;
    }
  }
  const jobs = [
    ['breed-chart', 'top10_dogs_lollipop/dog_chart.json'],
    ['council-breed-treemap', 'council_breed_treemap/council_breed_treemap.json'],
    ['dog-map', 'casey_dogs_proportional_symbol_map/dog_map.json'],
    ['registration-heatmap', 'group_registrations_heatmap/registration_heatmap.json'],
    ['townsville-bump', 'townsville_breeds_bump/townsville_bump.json'],
    ['townsville-connected-dots', 'townsville_breed_changes_connected_dot/townsville_connected_dots.json'],
    ['rspca-sankey', 'rspca_dog_outcomes_sankey/rspca_sankey.json'],
    ['dog-size-waffle', 'dog_size_waffle/dog_size_waffle.json']
  ];
  jobs.forEach(async ([id, path]) => {
    const view = await render(id, `diagrams/${path}`);
    if (!view) return;
    if (id === 'rspca-sankey') {
      const select = document.getElementById('rspca-state');
      select.disabled = false;
      select.addEventListener('change', async () => {
        const current = views.get(id);
        await current.signal('focusState', select.value).runAsync();
        const row = current.data('states').find(d => d.State === select.value);
        document.getElementById('rspca-selection-status').textContent = row
          ? `${row.State}: ${row.total.toLocaleString('en-AU')} records highlighted. The overall scale and totals remain fixed.`
          : 'All eight societies shown · 15,852 dog records.';
      });
    }
    if (id === 'dog-size-waffle') {
      const buttons = document.querySelectorAll('[data-dog-size]');
      buttons.forEach(button => {
        button.disabled = false;
        button.addEventListener('click', async () => {
          const current = views.get(id);
          const selected = button.dataset.dogSize;
          await current.signal('focusSize', selected).runAsync();
          buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
          const row = current.data('sizes').find(d => d.Size === selected);
          document.getElementById('dog-size-status').textContent = row
            ? `${row.Size}: ${row.Percent}% of dogs in the published size distribution (${row.Weight}).`
            : 'Each square represents one percentage point of the published size distribution.';
        });
      });
    }
  });

  // Existing map geometry, matching and deterministic dot allocation.
  const schema = "https://vega.github.io/schema/vega-lite/v5.json";
  const config = { view: { stroke: null }, font: BODY };
  // Orient polygon rings for Vega's geographic renderer.
  function prepare(features) {
    return features.filter(f => f.geometry).map(original => {
      const f = JSON.parse(JSON.stringify(original));

      const polygons = f.geometry.type === "Polygon"
        ? [f.geometry.coordinates]
        : f.geometry.coordinates;

      for (const polygon of polygons) {
        polygon.forEach((ring, index) => {
          let area = 0;

          for (let i = 0; i < ring.length - 1; i++) {
            area += ring[i][0] * ring[i + 1][1]
              - ring[i + 1][0] * ring[i][1];
          }

          if (
            (index === 0 && area > 0) ||
            (index > 0 && area < 0)
          ) {
            ring.reverse();
          }
        });
      }

      return f;
    });
  }

  function insideRing(x, y, ring) {
    let inside = false;

    for (
      let i = 0, j = ring.length - 1;
      i < ring.length;
      j = i++
    ) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];

      if (
        (yi > y) !== (yj > y) &&
        x < (xj - xi) * (y - yi) / (yj - yi) + xi
      ) {
        inside = !inside;
      }
    }

    return inside;
  }

  function makeDots(feature) {
    const p = feature.properties;

    const polygons = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

    const coordinates = polygons.flat(2);
    const xs = coordinates.map(c => c[0]);
    const ys = coordinates.map(c => c[1]);

    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);

    const radians = Math.PI / 180;
    const s0 = Math.sin(Math.min(...ys) * radians);
    const s1 = Math.sin(Math.max(...ys) * radians);

    // Fixed seed keeps illustrative dot positions stable.
    let seed = 202600 + Number(p.Division);

    const random = () => {
      seed = (
        Math.imul(1664525, seed) + 1013904223
      ) >>> 0;

      return seed / 4294967296;
    };

    const dots = [];
    const target = Math.round(p.Dogs2026 / 50);

    for (
      let attempts = 0;
      dots.length < target && attempts < 1000000;
      attempts++
    ) {
      const longitude = x0 + random() * (x1 - x0);

      const latitude = Math.asin(
        s0 + random() * (s1 - s0)
      ) / radians;

      const inside = polygons.some(polygon =>
        insideRing(longitude, latitude, polygon[0]) &&
        !polygon.slice(1).some(ring =>
          insideRing(longitude, latitude, ring)
        )
      );

      if (inside) {
        dots.push({ longitude, latitude, ...p });
      }
    }

    if (dots.length !== target) {
      throw new Error(
        `Dot allocation failed for ${p.DivisionName}`
      );
    }

    return dots;
  }

  // TOWNSVILLE: DOT-DENSITY MAP
  render("townsville-dot-map", async () => {
    const geo = await read(
      "diagrams/townsville_dog_decline_choropleth/townsville_dog_decline.geojson"
    );

    const features = prepare(geo.features);

    // Selected suburbs/localities for context, not exhaustive lists.
    const divisionDescriptions = {
      1: "Includes Deeragun, Jensen, Alice River, Rangewood, Bluewater and Rollingstone; parts of Black River and Bohle Plains.",
      2: "Includes Bushland Beach; most of Burdell, Mount Low and Beach Holm; parts of Saunders Beach, Yabulu and Black River.",
      3: "Includes North Ward, Belgian Gardens, Pallarenda, South Townsville and Magnetic Island; parts of Garbutt and Townsville City.",
      4: "Includes Kelso, Rasmussen, Pinnacles, Gumlow and Granite Vale; parts of Condon, Bohle Plains and Hervey Range.",
      5: "Includes parts of Kirwan, Thuringowa Central, Cranbrook and Mount Louisa.",
      6: "Includes Douglas, Annandale and Murray; parts of Condon, Thuringowa Central, Kirwan and Mount Stuart.",
      7: "Includes Heatley and parts of Kirwan, Mount Louisa and Cosgrove.",
      8: "Includes Aitkenvale and Vincent; parts of Cranbrook, Garbutt, Currajong, Gulliver and Mundingburra.",
      9: "Includes West End, Hyde Park, Pimlico, Mysterton, Hermit Park and Rosslea; parts of Railway Estate and Townsville City.",
      10: "Includes Wulguru, Idalia, Oonoonba, Cluden, Stuart, Alligator Creek and other southern rural localities; parts of Mount Stuart and Railway Estate."
    };

    for (const feature of features) {
      const division = Number(feature.properties.Division);

      feature.properties.Division = division;
      feature.properties.DivisionName =
        `Electoral Division ${division}`;

      feature.properties.Suburbs =
        divisionDescriptions[division] || "Description unavailable";
    }

    // Each dot inherits its division's description and total.
    const dots = features.flatMap(makeDots);

    function panel(selected, title, height) {
      const divisions = new Set(
        selected.map(f => f.properties.Division)
      );

      const tooltip = [
        {
          field: "properties.DivisionName",
          type: "nominal",
          title: "Area"
        },
        {
          field: "properties.Suburbs",
          type: "nominal",
          title: "Selected suburbs/localities"
        },
        {
          field: "properties.Dogs2026",
          type: "quantitative",
          title: "Dog records · March 2026",
          format: ",d"
        }
      ];

      return {
        width: 600,
        height,
        title,

        projection: {
          type: "azimuthalEqualArea",
          rotate: [-146.63, 19.35, 0]
        },

        layer: [
          {
            data: { values: selected },

            mark: {
              type: "geoshape",
              fill: "#F4F6F7",
              stroke: "#9AA8AE",
              strokeWidth: 0.8
            },

            encoding: { tooltip }
          },

          {
            data: {
              values: dots.filter(d =>
                divisions.has(d.Division)
              )
            },

            mark: {
              type: "circle",
              size: 13,
              color: "#157A86",
              opacity: 0.8
            },

            encoding: {
              longitude: {
                field: "longitude",
                type: "quantitative"
              },

              latitude: {
                field: "latitude",
                type: "quantitative"
              },

              tooltip: [
                {
                  field: "DivisionName",
                  type: "nominal",
                  title: "Area"
                },
                {
                  field: "Suburbs",
                  type: "nominal",
                  title: "Selected suburbs/localities"
                },
                {
                  field: "Dogs2026",
                  type: "quantitative",
                  title: "Division total · March 2026",
                  format: ",d"
                }
              ]
            }
          },

          {
            data: { values: selected },

            mark: {
              type: "text",
              fontSize: 12,
              fontWeight: "bold",
              color: "#152D34",
              dy: -6
            },

            encoding: {
              longitude: {
                field: "properties.LabelLongitude",
                type: "quantitative"
              },

              latitude: {
                field: "properties.LabelLatitude",
                type: "quantitative"
              },

              text: {
                field: "properties.Division"
              },

              tooltip
            }
          }
        ]
      };
    }

    return {
      $schema: schema,

      vconcat: [
        panel(
          features,
          "Townsville · March 2026 · one dot ≈ 50 records",
          400
        ),

        panel(
          features.filter(f =>
            [5, 6, 7, 8, 9].includes(f.properties.Division)
          ),
          "Enlarged view · divisions 5–9 · same dot value",
          280
        )
      ],

      spacing: 24,
      config
    };
  });

  // SOUTH AUSTRALIA: MULTI-DOG OWNERSHIP CHOROPLETH
  render("sa-ownership-map", async () => {
    const query = new URLSearchParams({
      where: "STATE_CODE_2021='4'",
      outFields: "LGA_NAME_2025",
      outSR: "4326",
      f: "geojson"
    });

    const [geo, csv] = await Promise.all([
      read(
        `https://geo.abs.gov.au/arcgis/rest/services/ASGS2025/LGA/FeatureServer/1/query?${query}`
      ),

      read(
        "diagrams/sa_dog_ownership/sa_dog_owners_2025.csv",
        "text"
      )
    ]);

    if (!geo.features) {
      throw new Error(
        "South Australian boundaries unavailable"
      );
    }

    const rows = vega.read(csv, { type: "csv" });

    const byName = new Map(
      rows.map(r => [r.Council, r])
    );

    const features = prepare(geo.features);

    for (const f of features) {
      const p = f.properties;
      const row = byName.get(p.LGA_NAME_2025);

      p.DogOwners = row ? +row.DogOwners : null;
      p.MultiDogOwners = row ? +row.MultiDogOwners : null;

      p.Share = row
        ? p.MultiDogOwners / p.DogOwners
        : null;
    }

    const matched = new Set(
      features.map(f => f.properties.LGA_NAME_2025)
    );

    for (const row of rows) {
      if (!matched.has(row.Council)) {
        throw new Error(
          `Unmatched council: ${row.Council}`
        );
      }
    }

    const metro = new Set([
      "Adelaide",
      "Burnside",
      "Campbelltown (SA)",
      "Charles Sturt",
      "Holdfast Bay",
      "Marion",
      "Mitcham",
      "Norwood Payneham and St Peters",
      "Playford",
      "Port Adelaide Enfield",
      "Prospect",
      "Salisbury",
      "Tea Tree Gully",
      "Unley",
      "Walkerville",
      "West Torrens"
    ]);

    function panel(selected, title, height) {
      return {
        width: 600,
        height,
        title,

        projection: {
          type: "azimuthalEqualArea",
          rotate: [-135, 32, 0]
        },

        data: { values: selected },

        mark: {
          type: "geoshape",
          stroke: "#FFFFFF",
          strokeWidth: 0.6
        },

        encoding: {
          color: {
            condition: {
              test: "isValid(datum.properties.Share)",
              field: "properties.Share",
              type: "quantitative",

              scale: {
                domain: [0, 0.45],
                scheme: "blues"
              },

              legend: {
                title: "Owners with 2+ dogs",
                format: ".0%",
                orient: "bottom"
              }
            },

            value: "#E0E0E0"
          },

          tooltip: [
            {
              field: "properties.LGA_NAME_2025",
              type: "nominal",
              title: "Council"
            },
            {
              field: "properties.DogOwners",
              type: "quantitative",
              title: "Recorded dog owners",
              format: ",d"
            },
            {
              field: "properties.MultiDogOwners",
              type: "quantitative",
              title: "Owners with 2+ dogs",
              format: ",d"
            },
            {
              field: "properties.Share",
              type: "quantitative",
              title: "Share with 2+ dogs",
              format: ".1%"
            }
          ]
        }
      };
    }

    return {
      $schema: schema,

      vconcat: [
        panel(
          features,
          "South Australia · recorded dog owners · 30 May 2025",
          450
        ),

        panel(
          features.filter(f =>
            metro.has(f.properties.LGA_NAME_2025)
          ),
          "Enlarged view · selected Adelaide metropolitan councils",
          320
        )
      ],

      resolve: {
        scale: { color: "shared" }
      },

      spacing: 24,
      config
    };
  });

})();