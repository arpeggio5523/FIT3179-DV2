
(async function () {
  'use strict';
  const BODY = 'Source Sans 3';
  const TITLE = 'Source Serif 4';
  const palette = ['#0072B2', '#B86B00', '#944D88', '#56B4E9', '#51565D', '#6044A0'];
  const views = new Map();
  const cache = new Map();
  const saState = { area: 'metro', zoom: 1, selected: '' };
  let saFeatures = [], saLayout, saController;
  const saMetro = new Set(['Adelaide', 'Burnside', 'Campbelltown (SA)', 'Charles Sturt',
    'Holdfast Bay', 'Marion', 'Mitcham', 'Norwood Payneham and St Peters', 'Playford',
    'Port Adelaide Enfield', 'Prospect', 'Salisbury', 'Tea Tree Gully', 'Unley',
    'Walkerville', 'West Torrens']);
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
    if (id === 'sa-ownership-map') return styleSAMap(spec, available);
    theme(spec);
    const isLite = spec.$schema.includes('vega-lite');
    if (id !== 'townsville-dot-map' && id !== 'sa-ownership-map') delete spec.title;
    let width = available;
    if (id === 'townsville-bump') width = Math.max(540, available);
    if (id === 'breed-chart') width = Math.max(420, available);
    if (['townsville-connected-dots', 'registration-heatmap'].includes(id)) width = Math.max(540, available);
    if (id === 'rspca-sankey') width = Math.max(660, available);
    if (id === 'council-breed-treemap') width = Math.max(240, available);
    if (id === 'dog-map') width = Math.max(380, available);
    if (spec.vconcat) {
      const panels = spec.vconcat;
      delete spec.vconcat;
      const sideBySide = available >= 640;
      // Vega titles and projection padding extend beyond the nominal plot width.
      // Reserve an explicit gutter for them, eliminating the 5–40 px scrollbars.
      const panelWidth = sideBySide
        ? Math.max(280, Math.floor((available - 104) / 2))
        : Math.max(220, available - 36);
      panels.forEach((p, i) => {
        p.width = panelWidth;
        // Centre each enlarged view on its own region. Distinct rotations also
        // prevent Vega-Lite from merging its projection with the overview.
        if (i === 1) p.projection.rotate = id === 'townsville-dot-map'
          ? [-146.75, 19.3, 0] : [-138.6, 34.9, 0];
        p.height = sideBySide ? 310 : (i === 0 ? 280 : 250);
        p.title = { text: i === 0 ? (id === 'townsville-dot-map' ? 'Townsville divisions' : 'South Australia') :
          (id === 'townsville-dot-map' ? 'Enlarged view · divisions 5–9' : 'Enlarged view · Adelaide'), font: TITLE, fontSize: 18, anchor: 'start' };
      });
      spec[sideBySide ? 'hconcat' : 'vconcat'] = panels;
      spec.spacing = 20;
      spec.bounds = 'flush';
      spec.config.legend.gradientLength = Math.min(260, panelWidth - 20);
      return spec;
    }
    spec.width = width;
    if (isLite) spec.autosize = { type: 'fit-x', contains: 'padding', resize: true };
    if (id === 'breed-chart') {
      spec.height = { step: 32 };
      spec.encoding.y.axis.labelFontSize = 13;
      spec.width = width - 225;
      spec.padding = { left: 210, right: 15, top: 8, bottom: 60 };
      spec.autosize = { type: 'none', contains: 'content' };
      spec.encoding.x.axis.tickCount = 4;
    }
    if (id === 'council-breed-treemap') {
      // Fixed bounds prevent hover updates from feeding back into fit-x sizing.
      spec.width = width - 8;
      spec.height = 310;
      spec.padding = { left: 4, right: 4, top: 4, bottom: 88 };
      spec.autosize = { type: 'none', contains: 'content', resize: false };
      const tiles = spec.marks.find(mark => mark.name === 'tiles');
      tiles.encode.update.strokeWidth = { value: 2 };
      tiles.encode.hover.strokeWidth = { value: 2 };
      // Hover changes colour only; neither tile geometry nor outer bounds change.
      if (Array.isArray(spec.legends)) spec.legends.forEach(legend => {
        legend.gradientLength = Math.min(320, width - 40);
        legend.titleLimit = width - 16;
        legend.title = 'Councils listing the breed in their top five';
      });
    }
    if (id === 'dog-map') {
      spec.height = 360;
      walk(spec, obj => { if (obj.legend) { obj.legend.orient = 'bottom'; obj.legend.title = 'Casey · dog records'; obj.legend.offset = 8; } });
      const dogsUrl = 'diagrams/casey_dogs_proportional_symbol_map/dogs_by_suburb.json';
      spec.layer.push(
        {
          data: { url: dogsUrl },
          transform: [{ filter: "datum.Suburb === 'Berwick'" }],
          mark: { type: 'circle', filled: false, stroke: '#172c40', strokeWidth: 2.2 },
          encoding: {
            longitude: { field: 'Longitude', type: 'quantitative' },
            latitude: { field: 'Latitude', type: 'quantitative' },
            size: { field: 'DogCount', type: 'quantitative', scale: { type: 'linear', domain: [0, 5000], range: [0, 2850] }, legend: null }
          }
        },
        {
          data: {
            values: [
              { group: 'berwick-callout', step: 1, Longitude: 145.34263756034233, Latitude: -38.046883260375 },
              { group: 'berwick-callout', step: 2, Longitude: 145.372, Latitude: -38.018 },
              { group: 'berwick-callout', step: 3, Longitude: 145.405, Latitude: -38.018 }
            ]
          },
          mark: { type: 'line', stroke: '#405466', strokeWidth: 1.3 },
          encoding: {
            longitude: { field: 'Longitude', type: 'quantitative' },
            latitude: { field: 'Latitude', type: 'quantitative' },
            detail: { field: 'group' },
            order: { field: 'step' }
          }
        },
        {
          data: {
            values: [{ Longitude: 145.407, Latitude: -38.014, note: 'Highest recorded count\nBerwick · 4,971 dogs\n18.0% of Casey total' }]
          },
          mark: {
            type: 'text',
            align: 'left',
            baseline: 'top',
            dx: 8,
            dy: -2,
            lineBreak: '\n',
            font: BODY,
            fontSize: 11,
            fontWeight: 600,
            fill: '#172c40'
          },
          encoding: {
            longitude: { field: 'Longitude', type: 'quantitative' },
            latitude: { field: 'Latitude', type: 'quantitative' },
            text: { field: 'note' }
          }
        }
      );
    }
    if (id === 'registration-heatmap') {
      // Use more of the left column. The seven group names still fit in the
      // reserved axis-label gutter, while the cells gain horizontal space.
      const leftGutter = 90;
      spec.width = width - leftGutter - 10;
      spec.height = 230;
      spec.padding = { left: leftGutter, right: 10, top: 8, bottom: 104 };
      spec.autosize = { type: 'none', contains: 'content' };
      // Keep cell values in hover tooltips only.
    }
    if (id === 'townsville-bump') {
      // Measure the complete endpoint labels instead of reserving 275px blindly.
      const measure = document.createElement('canvas').getContext('2d');
      measure.font = `600 13px "${BODY}", Arial, sans-serif`;
      const endpointLabels = ['Maltese Terrier Cross', 'Staffordshire Bull Terrier Cross',
        'Staffordshire Bull Terrier', 'Jack Russell Terrier', 'Dachshund', 'Miniature Dachshund'];
      const labelGutter = Math.ceil(Math.max(...endpointLabels.map(text => measure.measureText(text).width))) + 22;
      spec.width = width - 55 - labelGutter;
      spec.height = 610;
      spec.padding = { left: 55, top: 16, right: labelGutter, bottom: 72 };
      // Let the first and last year reach the plot edges rather than inset by half a step.
      spec.encoding.x.scale = { ...spec.encoding.x.scale, padding: 0 };
      spec.autosize = { type: 'none', contains: 'content' };
      spec.encoding.y.title = 'Rank · 1 is highest';
      walk(spec, obj => {
        if (obj.scale?.domain?.[0] === 'Maltese Terrier Cross') obj.scale.range = palette;
      });
      const points = spec.layer[3];
      // Use the same circular symbol for focus and context breeds.
      spec.layer.forEach(layer => {
        if (layer.mark?.type === 'point') {
          layer.mark.shape = 'circle';
          if (layer.encoding) delete layer.encoding.shape;
        }
      });
      points.mark.size = 95;
      const labels = spec.layer[4];
      labels.mark.fontSize = 13;
      labels.encoding.color.condition = { test: "datum.Breed === 'Jack Russell Terrier'", value: '#246B8E' };
      labels.mark.dy = { expr: "datum.Breed === 'Dachshund' ? -5 : datum.Breed === 'Miniature Dachshund' ? 5 : 0" };
    }
    if (id === 'townsville-connected-dots') {
      // Reserve only the room needed for the full breed names, rather than a
      // fixed 225px. Move the plot left and let its data area stretch right.
      const breeds = ['Staffordshire Bull Terrier', 'Maltese Terrier Cross',
        'Staffordshire Bull Terrier Cross', 'Jack Russell Terrier',
        'Dachshund', 'Miniature Dachshund'];
      const measure = document.createElement('canvas').getContext('2d');
      measure.font = `13px "${BODY}", Arial, sans-serif`;
      const leftGutter = Math.ceil(Math.max(...breeds.map(name => measure.measureText(name).width))) + 18;
      const rightGutter = 20;
      spec.width = width - leftGutter - rightGutter;
      spec.padding = { left: leftGutter, right: rightGutter, top: 10, bottom: 65 };
      spec.autosize = { type: 'none', contains: 'content' };
      spec.height = { step: 32 };
      spec.layer[1].encoding.color.scale.range = ['#B86B00', '#0072B2'];
      // Colour differentiates the years; use one consistent circular shape.
      spec.layer[1].mark.shape = 'circle';
      delete spec.layer[1].encoding.shape;
    }
    if (id === 'dog-size-waffle') {
      // Size the tiles and legend together, rather than leaving an empty panel.
      const compact = width < 540;
      const legendColumns = compact && width >= 390;
      const gridSize = Math.min(280, width - 16);
      spec.height = compact ? gridSize + (legendColumns ? 86 : 190) : 304;
      const signal = name => spec.signals.find(s => s.name === name);
      signal('compact').update = 'width < 540';
      signal('gridSize').update = 'min(280, width - 16)';
      signal('gridX').update = 'compact ? (width - gridSize) / 2 : max(8, (width - 510) / 2)';
      signal('legendX').update = 'compact ? 12 : gridX + gridSize + 28';
      signal('legendY').update = 'compact ? gridSize + 32 : 38';
      spec.scales[0].range = ['#17658F', '#8364A9', '#D39A45'];
      for (const mark of spec.marks) {
        if (mark.from?.data !== 'sizes') continue;
        const enc = mark.encode.update;
        const text = mark.type === 'text';
        const secondary = Boolean(enc.text?.field);
        enc.x = { signal: `legendX + ${legendColumns ? 'datum.Order * (width / 3) + ' : ''}${text ? 23 : 0}` };
        enc.y = { signal: `legendY + ${legendColumns ? '' : 'datum.Order * (compact ? 50 : 86) + '}${text ? (secondary ? 31 : 13) : 0}` };
        if (text) enc.fontSize = { value: secondary ? 13 : 16 };
      }
    }
    if (id === 'rspca-sankey') {
      spec.height = 480;
      spec.scales.find(s => s.name === 'outcomeColor').range =
        ['#17658F', '#72A7CC', '#B87722', '#8364A9', '#C5A253', '#535D70', '#B5BAC2'];
      // Reserve space inside the SVG for complete labels on both sides.
      spec.padding = 0;
      spec.autosize = { type: 'none', contains: 'padding' };
      spec.signals.find(s => s.name === 'sourceX').update = '220';
      spec.signals.find(s => s.name === 'targetX').update = 'width - 210';
      spec.signals.find(s => s.name === 'unit').update =
        '(height - chartTop - 30 - 7 * nodeGap) / 15852';
    }
    return spec;
  }
  // SA overview + controlled detail map. These controls change geography only;
  // they never change the percentage denominator or the shared colour domain.
  function saFocusFeatures(features) {
    return saState.area === 'metro'
      ? features.filter(f => saMetro.has(f.properties.LGA_NAME_2025))
      : features.filter(f => f.properties.LGA_NAME_2025 === saState.area);
  }
  function saProjectionFit(features, width, height) {
    const focus = saFocusFeatures(features);
    if (!focus.length) throw new Error('No boundary found for the selected map centre');
    const projection = vega.projection('azimuthalEqualArea')()
      .rotate([-135, 32, 0])
      .fitExtent([[18, 18], [width - 18, height - 18]], {
        type: 'FeatureCollection', features: focus
      });
    return { scale: projection.scale(), translate: projection.translate() };
  }
  function styleSAMap(spec, available) {
    saFeatures = spec.vconcat[0].data.values;
    const sideBySide = available >= 640;
    const width = sideBySide ? Math.floor((available - 96) / 2) : Math.max(220, available - 36);
    const height = sideBySide ? 320 : 290;
    saLayout = { width, height };
    const fit = saProjectionFit(saFeatures, width, height);
    const tooltip = [
      { field: 'properties.LGA_NAME_2025', type: 'nominal', title: 'Council' },
      { field: 'properties.DogOwners', type: 'quantitative', title: 'Recorded dog owners', format: ',d' },
      { field: 'properties.MultiDogOwners', type: 'quantitative', title: 'Owners with 2+ dogs', format: ',d' },
      { field: 'properties.Share', type: 'quantitative', title: 'Share with 2+ dogs', format: '.1%' }
    ];
    function panel(detail) {
      return {
        width, height,
        title: detail ? 'Detail · explore councils' : 'South Australia · overview',
        projection: detail ? {
          type: 'azimuthalEqualArea', rotate: [-135, 32, 0],
          scale: { expr: 'saBaseScale * saZoom / 3' },
          translate: { expr: `[(saBaseTranslate[0] - ${width / 2}) * saZoom / 3 + ${width / 2}, (saBaseTranslate[1] - ${height / 2}) * saZoom / 3 + ${height / 2}]` }
        } : { type: 'azimuthalEqualArea', rotate: [-135, 32, 0] },
        data: { values: saFeatures },
        layer: [
          {
            // At maximum zoom, isolate the fitted focus area in the detail panel.
            // The overview always retains every council and the shared scale.
            ...(detail ? { transform: [{ filter: "saZoom < 2.999 || indexof(saFocusNames, datum.properties.LGA_NAME_2025) >= 0" }] } : {}),
            mark: { type: 'geoshape', stroke: '#ffffff', strokeWidth: .65, clip: true },
            encoding: {
              color: {
                condition: { test: 'isValid(datum.properties.Share)', field: 'properties.Share', type: 'quantitative',
                  scale: { domain: [0, .45], scheme: 'blues', clamp: true },
                  legend: { title: 'Owners with 2+ dogs', orient: 'bottom', format: '.0%', gradientLength: Math.min(260, width - 20) }
                }, value: '#E0E0E0'
              }, tooltip
            }
          },
          {
            transform: [{ filter: "saSelectedCouncil !== '' && datum.properties.LGA_NAME_2025 === saSelectedCouncil" }, ...(detail ? [{ filter: "saZoom < 2.999 || indexof(saFocusNames, datum.properties.LGA_NAME_2025) >= 0" }] : [])],
            mark: { type: 'geoshape', fillOpacity: 0, stroke: '#172c40', strokeWidth: 2.5, clip: true },
            encoding: { tooltip }
          }
        ]
      };
    }
    const result = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      params: [
        { name: 'saFocusNames', value: saFocusFeatures(saFeatures).map(f => f.properties.LGA_NAME_2025) },
        { name: 'saBaseScale', value: fit.scale },
        { name: 'saBaseTranslate', value: fit.translate },
        { name: 'saZoom', value: saState.zoom },
        { name: 'saSelectedCouncil', value: saState.selected }
      ],
      [sideBySide ? 'hconcat' : 'vconcat']: [panel(false), panel(true)],
      spacing: 28, bounds: 'flush', resolve: { scale: { color: 'shared' } },
      config: { view: { stroke: null } }
    };
    return theme(result);
  }
  function setupSAControls() {
    const host = document.getElementById('sa-ownership-map');
    const viewport = host.closest('.chart-scroll');
    const panel = viewport.parentElement;
    const controls = document.createElement('div');
    controls.className = 'new-chart-controls sa-map-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Explore South Australian councils');
    controls.innerHTML = `
      <label for="sa-centre">Map centre</label>
      <select id="sa-centre" aria-controls="sa-ownership-map" style="max-width:100%;width:260px">
        <option value="metro">Adelaide metropolitan area</option>
        <optgroup label="Centre on a council"></optgroup>
      </select>
      <div class="sa-zoom-control">
        <div class="sa-zoom-heading"><label for="sa-zoom">Detail zoom</label>
          <output id="sa-zoom-value" for="sa-zoom">1.0×</output></div>
        <input id="sa-zoom" aria-controls="sa-ownership-map" type="range" min="1" max="3" step="0.1" value="1">
        <div class="sa-zoom-ends" aria-hidden="true"><span>Surroundings</span><span>Selected area</span></div>
      </div>
      <button type="button" id="sa-reset">Reset view</button>`;
    if (!document.getElementById('sa-control-styles')) {
      const style = document.createElement('style');
      style.id = 'sa-control-styles';
      style.textContent = `
        .sa-map-controls { gap: 12px 16px; align-items: center; justify-content: flex-start; padding: 10px 0; margin: 10px 0 8px; background: transparent; border: 0; border-radius: 0; }
        .sa-map-controls .sa-zoom-control { width: 260px; max-width: 100%; margin: 0 6px; }
        .sa-zoom-heading { display: flex; align-items: center; justify-content: space-between; }
        .sa-zoom-heading label { margin: 0; }
        .sa-zoom-heading output { padding: 2px 9px; border-radius: 5px; background: #e4eff6; color: #155f8a; font: 600 14px 'Source Sans 3', sans-serif; font-variant-numeric: tabular-nums; }
        #sa-zoom { --range-fill: 0%; appearance: none; -webkit-appearance: none; display: block; width: 100%; height: 28px; margin: 5px 0 0; padding: 0; background: transparent; cursor: pointer; border: 0; }
        #sa-zoom::-webkit-slider-runnable-track { height: 6px; border-radius: 4px; background: linear-gradient(to right, #17658f 0%, #17658f var(--range-fill), #cdd9e3 var(--range-fill), #cdd9e3 100%); }
        #sa-zoom::-moz-range-track { height: 6px; border-radius: 4px; background: #cdd9e3; }
        #sa-zoom::-moz-range-progress { height: 6px; border-radius: 4px; background: #17658f; }
        #sa-zoom::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 18px; height: 18px; margin-top: -6px; border: 3px solid white; border-radius: 50%; background: #17658f; box-shadow: 0 0 0 1px #17658f, 0 2px 4px #0002; }
        #sa-zoom::-moz-range-thumb { box-sizing: border-box; width: 18px; height: 18px; border: 3px solid white; border-radius: 50%; background: #17658f; box-shadow: 0 0 0 1px #17658f, 0 2px 4px #0002; }
        #sa-zoom:focus-visible { outline: 2px solid #17658f; outline-offset: 4px; border-radius: 5px; }
        .sa-zoom-ends { display: flex; justify-content: space-between; gap: 16px; font: 13px/1.4 'Source Sans 3', sans-serif; color: #526372; }
        @media (max-width: 600px) { .sa-map-controls { padding: 10px 0; } .sa-map-controls .sa-zoom-control { width: 100%; margin: 0; } }
      `;
      document.head.appendChild(style);
    }
    // Show the overview and detail maps first, then offer exploration controls.
    // This keeps controls clearly attached to the map they affect.
    viewport.insertAdjacentElement('afterend', controls);
    const hint = document.createElement('p');
    hint.className = 'note'; hint.id = 'sa-map-hint';
    hint.textContent = 'Zoom the detail map from its surroundings (1×) to the selected area (3×). Hover or click a council for its recorded values. The overview and colour scale stay fixed.';
    controls.insertAdjacentElement('afterend', hint);
    const detail = document.createElement('p');
    detail.id = 'sa-council-detail'; detail.className = 'takeaway';
    detail.setAttribute('role', 'status'); detail.setAttribute('aria-live', 'polite');
    detail.setAttribute('aria-atomic', 'true');
    detail.style.margin = '18px 0 0';
    panel.appendChild(detail);
    const centre = controls.querySelector('#sa-centre');
    const zoom = controls.querySelector('#sa-zoom');
    const output = controls.querySelector('#sa-zoom-value');
    centre.setAttribute('aria-describedby', hint.id);
    zoom.setAttribute('aria-describedby', hint.id);
    const group = centre.querySelector('optgroup');
    saFeatures.filter(f => Number.isFinite(f.properties.Share))
      .sort((a, b) => a.properties.LGA_NAME_2025.localeCompare(b.properties.LGA_NAME_2025))
      .forEach(f => group.appendChild(new Option(f.properties.LGA_NAME_2025, f.properties.LGA_NAME_2025)));
    let pending = false;
    let dirty = false;
    async function sync() {
      dirty = true;
      if (pending) return;
      pending = true;
      try {
        while (dirty) {
          dirty = false;
          const fit = saProjectionFit(saFeatures, saLayout.width, saLayout.height);
          const view = views.get('sa-ownership-map');
          if (view) await view.signal('saFocusNames', saFocusFeatures(saFeatures).map(f => f.properties.LGA_NAME_2025))
            .signal('saBaseScale', fit.scale)
            .signal('saBaseTranslate', fit.translate)
            .signal('saZoom', saState.zoom)
            .signal('saSelectedCouncil', saState.selected).runAsync();
        }
      } finally { pending = false; }
    }
    function explain() {
      output.value = `${saState.zoom.toFixed(1)}×`;
      zoom.style.setProperty('--range-fill', `${(saState.zoom - 1) / 2 * 100}%`);
      zoom.setAttribute('aria-valuetext', `${saState.zoom.toFixed(1)} times the surrounding-area view${saState.zoom === 3 ? ', selected area only' : ''}`);
      const feature = saFeatures.find(f => f.properties.LGA_NAME_2025 === saState.selected);
      if (!feature) {
        detail.textContent = 'Overview: darker blue means a higher share of recorded owners with two or more dogs. The detail map starts with Adelaide metropolitan councils.';
        return;
      }
      const p = feature.properties;
      detail.textContent = Number.isFinite(p.Share)
        ? `${p.LGA_NAME_2025}: ${(p.Share * 100).toFixed(1)}% of recorded dog owners had two or more dogs (${p.MultiDogOwners.toLocaleString('en-AU')} of ${p.DogOwners.toLocaleString('en-AU')} owners). Snapshot: 30 May 2025.`
        : `${p.LGA_NAME_2025}: no matched owner data. Grey does not mean zero.`;
    }
    function update() {
      explain();
      sync().catch(error => {
        console.error('SA map interaction', error);
        detail.textContent = 'The map could not update. Please reload the page.';
      });
    }
    centre.addEventListener('change', () => {
      saState.area = centre.value; saState.zoom = 1;
      saState.selected = centre.value === 'metro' ? '' : centre.value;
      zoom.value = '1'; update();
    });
    zoom.addEventListener('input', () => { saState.zoom = Number(zoom.value); update(); });
    controls.querySelector('#sa-reset').addEventListener('click', () => {
      Object.assign(saState, { area: 'metro', zoom: 1, selected: '' });
      centre.value = 'metro'; zoom.value = '1'; update();
    });
    function attach(view) {
      view.addEventListener('click', (event, item) => {
        const name = item?.datum?.properties?.LGA_NAME_2025;
        if (!name) return;
        saState.selected = name; update();
      });
    }
    attach(views.get('sa-ownership-map')); explain();
    return { attach };
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
        if (Math.abs(width - previousWidth) < 2 || width < 1) return;
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
          if (id === 'sa-ownership-map') saController?.attach(result.view);
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
  }).then(view => {
    if (view) saController = setupSAControls();
  });

})();