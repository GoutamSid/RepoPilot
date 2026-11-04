const $ = (id) => document.getElementById(id);

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'onclick') node.addEventListener('click', value);
    else if (key === 'attrs') for (const [name, attr] of Object.entries(value)) node.setAttribute(name, attr);
    else node[key] = value;
  }
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

async function api(path, body) {
  const options = body === undefined
    ? {}
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function say(text, isError = false) {
  const message = $('message');
  message.textContent = text;
  message.className = isError ? 'error' : 'ok';
}

async function run(action, successText) {
  try {
    render(await action());
    if (successText) say(successText);
  } catch (error) {
    say(error.message, true);
  }
}

function render(state) {
  $('projects-path').textContent = state.settings.projectsFolder || 'Not set';
  $('website-path').textContent = state.settings.websiteFolder || 'Not set';
  renderProjects(state);
}

function renderProjects(state) {
  const container = $('projects');
  container.replaceChildren();
  if (state.projectsError) container.append(el('p', { class: 'error', text: state.projectsError }));
  if (!state.settings.projectsFolder) {
    $('summary').textContent = '';
    container.append(el('p', { class: 'muted', text: 'Choose your projects folder to see its projects.' }));
    return;
  }

  const ready = state.folders.filter((entry) => entry.status === 'ready');
  const shown = ready.filter((entry) => entry.project.show).length;
  $('summary').textContent = `${shown} shown · ${ready.length} with project.json · ${state.folders.length} folders`;

  const sections = [...new Set(['Projects', ...ready.map((entry) => entry.project.section)])].sort();
  container.append(el('datalist', { id: 'sections' }, sections.map((section) => el('option', { value: section }))));
  for (const entry of state.folders) {
    container.append(entry.status === 'missing' ? missingRow(entry) : projectForm(entry, state.stages));
  }
}

function missingRow(entry) {
  return el('div', { class: 'missing' }, [
    el('span', {}, [
      el('strong', { text: entry.folder }),
      el('span', { class: 'muted', text: '  no project.json yet' }),
    ]),
    el('button', {
      type: 'button',
      text: 'Create project.json',
      onclick: () => run(() => api('/api/template', { folder: entry.folder }), `Created project.json in ${entry.folder}.`),
    }),
  ]);
}

function projectForm(entry, stages) {
  const invalid = entry.status === 'invalid';
  const project = entry.project ?? {
    name: entry.folder, description: '', section: 'Projects', stage: 'In development',
    website: '', featured: false, show: false,
  };
  const field = (label, control, wide = false) => el('label', { class: wide ? 'wide' : '' }, [el('span', { text: label }), control]);
  const textInput = (name, value, extra = {}) => el('input', { type: 'text', name, value, ...extra });
  const check = (name, label, checked) => el('label', { class: 'check' }, [
    el('input', { type: 'checkbox', name, checked }),
    el('span', { text: label }),
  ]);
  const stage = el('select', { name: 'stage' }, stages.map((option) => el('option', {
    value: option, text: option, selected: option === project.stage,
  })));

  const status = invalid
    ? el('span', { class: 'warn', text: `project.json has problems: ${entry.errors.join(' ')} Saving will replace it.` })
    : el('span', { class: 'muted', text: project.show ? 'Shown on website' : 'Hidden from website' });

  const form = el('form', { class: 'project' }, [
    el('div', { class: 'project-head' }, [el('strong', { text: entry.folder }), status]),
    field('Name', textInput('name', project.name)),
    field('Section', textInput('section', project.section, { attrs: { list: 'sections' } })),
    field('Stage', stage),
    field('Website URL (optional)', textInput('website', project.website, { placeholder: 'https://' })),
    field('Description', el('textarea', { name: 'description', rows: 2, value: project.description }), true),
    el('div', { class: 'wide row' }, [
      check('show', 'Show on website', project.show),
      check('featured', 'Featured', project.featured),
      el('button', { type: 'submit', class: 'primary', text: 'Save project' }),
    ]),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const value = {
      name: data.get('name'),
      section: data.get('section'),
      stage: data.get('stage'),
      website: data.get('website'),
      description: data.get('description'),
      show: data.has('show'),
      featured: data.has('featured'),
    };
    run(() => api('/api/project', { folder: entry.folder, value }), `Saved ${value.name}.`);
  });
  return form;
}

async function pickFolder(kind) {
  try {
    const picked = await api('/api/pick-folder', { kind });
    if (!picked.path) return say('No folder selected.');
    render(await api('/api/folder', { kind, path: picked.path }));
    say('Folder saved.');
  } catch (error) {
    say(error.message, true);
  }
}

$('pick-projects').onclick = () => pickFolder('projects');
$('pick-website').onclick = () => pickFolder('website');
$('save-projects').onclick = () => run(() => api('/api/folder', { kind: 'projects', path: $('projects-input').value }), 'Folder saved.');
$('save-website').onclick = () => run(() => api('/api/folder', { kind: 'website', path: $('website-input').value }), 'Folder saved.');
$('save-output').onclick = () => run(() => api('/api/output', { outputRelativePath: $('output-input').value }), 'JSON path saved.');

$('preview').onclick = async () => {
  try {
    const result = await api('/api/preview');
    $('preview-output').textContent = JSON.stringify(result.data, null, 2);
    $('preview-output').hidden = false;
    say(`${result.count} project(s) would be written${result.outputPath ? ` to ${result.outputPath}` : ''}.`);
  } catch (error) {
    say(error.message, true);
  }
};

$('write').onclick = async () => {
  if (!confirm('Write the website JSON now? It replaces the existing file. Nothing is committed or pushed.')) return;
  try {
    const result = await api('/api/write', {});
    say(`Wrote ${result.count} project(s) to ${result.outputPath}. Review it in VS Code, then commit it yourself.`);
  } catch (error) {
    say(error.message, true);
  }
};

(async () => {
  try {
    const state = await api('/api/state');
    $('output-input').value = state.settings.outputRelativePath;
    render(state);
  } catch (error) {
    say(error.message, true);
  }
})();
