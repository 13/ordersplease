<script lang="ts">
  import { tick } from 'svelte';
  import { t, locale } from '../i18n';
  import { keynav } from '../lib/keynav';
  import { go } from '../lib/router';
  import { menuProfiles, activeProfileId, activeProfile } from '../stores/menu';
  import { settings } from '../stores/settings';
  import { validateItem, parseImportedProfile, newProfileId, moveMenuItem } from '../core/menu';
  import { indexAtY } from '../lib/dragsort';
  import { MENU_PRESETS, presetItems, presetName } from '../core/menu-presets';
  import { formatEuro, parseEuro } from '../core/money';

  let newName = $state('');
  let newPrice = $state('');
  let newCategory = $state<'drink' | 'food'>('drink');
  let error = $state<string | null>(null);
  let newProfileName = $state('');
  let importError = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  let editingId = $state<string | null>(null);
  let editName = $state('');
  let editPrice = $state('');
  let editError = $state<string | null>(null);
  let listEl = $state<HTMLUListElement | null>(null);
  let grabbedId = $state<string | null>(null); // keyboard grab-and-move
  let dragId = $state<string | null>(null);    // pointer drag
  let dragPointer = -1;

  function updateActive(fn: (items: import('../core/menu').MenuItem[]) => import('../core/menu').MenuItem[]) {
    menuProfiles.update((profiles) => profiles.map((p) =>
      p.id === $activeProfileId ? { ...p, items: fn(p.items) } : p));
  }

  function add() {
    const cents = parseEuro(newPrice);
    const err = validateItem(newName, cents ?? -1);
    if (err) {
      error = err;
      return;
    }
    updateActive((items) => [
      ...items,
      { id: `custom-${Date.now()}`, name: newName.trim(), priceCents: cents!, category: newCategory },
    ]);
    newName = '';
    newPrice = '';
    error = null;
  }

  function remove(id: string) {
    if (editingId === id) editingId = null;
    if (grabbedId === id) grabbedId = null;
    updateActive((items) => items.filter((x) => x.id !== id));
  }

  function startEdit(item: import('../core/menu').MenuItem) {
    editingId = item.id;
    editName = item.name;
    editPrice = formatEuro(item.priceCents, false).replace(/[^\d,]/g, '');
    editError = null;
  }

  function cancelEdit() {
    editingId = null;
    editError = null;
  }

  function commitEdit(id: string) {
    const cents = parseEuro(editPrice);
    const err = validateItem(editName, cents ?? -1);
    if (err) {
      editError = err;
      return;
    }
    updateActive((items) => items.map((x) =>
      x.id === id ? { ...x, name: editName.trim(), priceCents: cents! } : x));
    editingId = null;
    editError = null;
  }

  function onEditKey(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(id); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelEdit(); }
  }

  function toggleCategory(id: string) {
    updateActive((items) => items.map((x) =>
      x.id === id ? { ...x, category: x.category === 'food' ? 'drink' : 'food' } : x));
  }

  function handleEl(id: string) {
    return listEl?.querySelector<HTMLButtonElement>(`[data-handle="${CSS.escape(id)}"]`) ?? null;
  }

  function indexOf(id: string) {
    return ($activeProfile?.items ?? []).findIndex((x) => x.id === id);
  }

  /** Reordering relocates the row's DOM node, which can drop focus — keyboard
   *  moves put it back on the same handle so the arrows can be held down. */
  async function move(id: string, to: number, refocus: boolean) {
    if (to === indexOf(id)) return;
    updateActive((items) => moveMenuItem(items, items.findIndex((x) => x.id === id), to));
    if (!refocus) return;
    await tick();
    handleEl(id)?.focus();
  }

  const UP = ['ArrowUp', 'k', '8'];
  const DOWN = ['ArrowDown', 'j', '2'];

  function onHandleKey(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); // also suppresses the button's synthesized click
      grabbedId = grabbedId === id ? null : id;
      return;
    }
    if (grabbedId !== id) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      grabbedId = null;
      return;
    }
    const dir = UP.includes(e.key) ? -1 : DOWN.includes(e.key) ? 1 : 0;
    if (dir === 0) return;
    e.preventDefault();
    e.stopPropagation(); // keynav would otherwise steal the arrow to move focus
    move(id, indexOf(id) + dir, true);
  }

  function onListFocusOut(e: FocusEvent) {
    // relatedTarget is null when a reorder relocates the focused node; only
    // release the grab when focus demonstrably went somewhere else
    const to = e.relatedTarget as Node | null;
    if (to && !listEl?.contains(to)) grabbedId = null;
  }

  function onHandleDown(e: PointerEvent, id: string) {
    if (e.button > 0 || !listEl) return;
    // capture on the list, not the row: the row moves during the drag
    listEl.setPointerCapture(e.pointerId);
    dragPointer = e.pointerId;
    dragId = id;
    grabbedId = null;
  }

  function onListMove(e: PointerEvent) {
    if (dragId === null || e.pointerId !== dragPointer || !listEl) return;
    e.preventDefault();
    const rows = [...listEl.querySelectorAll('li')].map((li) => {
      const r = li.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });
    const to = indexAtY(rows, e.clientY);
    if (to !== -1) move(dragId, to, false);
  }

  function endDrag(e: PointerEvent) {
    if (e.pointerId !== dragPointer) return;
    listEl?.releasePointerCapture(e.pointerId);
    dragId = null;
    dragPointer = -1;
  }

  function renameProfile(name: string) {
    menuProfiles.update((profiles) => profiles.map((p) =>
      p.id === $activeProfileId ? { ...p, name } : p));
  }

  function createProfile() {
    const name = newProfileName.trim();
    if (name === '') return;
    const id = newProfileId();
    menuProfiles.update((profiles) => [...profiles, { id, name, items: [] }]);
    activeProfileId.set(id);
    newProfileName = '';
  }

  function deleteProfile() {
    if ($menuProfiles.length <= 1) return;
    if (!confirm($t('menu.delete-profile-confirm'))) return;
    const remaining = $menuProfiles.filter((p) => p.id !== $activeProfileId);
    menuProfiles.set(remaining);
    activeProfileId.set(remaining[0].id);
  }

  function loadPreset(presetId: string) {
    const preset = MENU_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const id = newProfileId();
    menuProfiles.update((profiles) => [
      ...profiles,
      { id, name: presetName(preset, $locale), items: presetItems(preset, $locale) },
    ]);
    activeProfileId.set(id);
  }

  function exportProfile() {
    const profile = $activeProfile;
    if (!profile) return;
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.name.replace(/[^\w\- ]+/g, '').trim() || 'menu'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    importError = null;
    file.text().then((text) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        importError = 'menu.import-error';
        return;
      }
      const profile = parseImportedProfile(parsed);
      if (!profile) {
        importError = 'menu.import-error';
        return;
      }
      menuProfiles.update((profiles) => [...profiles, profile]);
      activeProfileId.set(profile.id);
    }).finally(() => {
      input.value = '';
    });
  }
</script>

<main class="editor" use:keynav>
  <h2><button class="back" onclick={() => go('home')} aria-label={$t('nav.back')}>←</button> {$t('menu.title')}</h2>

  <label class="toggle">
    <input type="checkbox" bind:checked={$settings.useCustomMenu} />
    {$t('menu.use-custom')}
  </label>

  <div class="profiles">
    <select bind:value={$activeProfileId} aria-label={$t('menu.profile')}>
      {#each $menuProfiles as p (p.id)}
        <option value={p.id}>{p.name}</option>
      {/each}
    </select>
    <button class="danger" onclick={deleteProfile} disabled={$menuProfiles.length <= 1}>
      {$t('menu.delete-profile')}
    </button>
  </div>

  <label class="rename">
    {$t('menu.rename')}
    <input
      value={$activeProfile?.name ?? ''}
      oninput={(e) => renameProfile((e.target as HTMLInputElement).value)}
    />
  </label>

  <div class="new-profile">
    <input placeholder={$t('menu.new-profile-name')} bind:value={newProfileName} />
    <button onclick={createProfile}>{$t('menu.new-profile')}</button>
  </div>

  <div class="presets">
    <span class="label">{$t('menu.presets')}</span>
    <div class="preset-row">
      {#each MENU_PRESETS as preset (preset.id)}
        <button onclick={() => loadPreset(preset.id)}>{presetName(preset, $locale)}</button>
      {/each}
    </div>
  </div>

  <div class="io">
    <button onclick={exportProfile}>{$t('menu.export')}</button>
    <button onclick={() => fileInput?.click()}>{$t('menu.import')}</button>
    <input
      type="file" accept="application/json" class="hidden-file"
      bind:this={fileInput} onchange={onImportFile}
    />
  </div>
  {#if importError}<p class="error">{$t(importError)}</p>{/if}

  <ul
    bind:this={listEl}
    onfocusout={onListFocusOut}
    onpointermove={onListMove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  >
    {#each $activeProfile?.items ?? [] as item (item.id)}
      {#if editingId === item.id}
        <li class="editing">
          <input
            class="edit-name" bind:value={editName}
            onkeydown={(e) => onEditKey(e, item.id)}
          />
          <input
            class="edit-price" inputmode="decimal" bind:value={editPrice}
            onkeydown={(e) => onEditKey(e, item.id)}
          />
          <button class="ok" onclick={() => commitEdit(item.id)} aria-label={$t('menu.confirm-edit')}>✓</button>
          <button class="cancel" onclick={cancelEdit} aria-label={$t('menu.cancel-edit')}>✕</button>
          {#if editError}<p class="error edit-error">{$t(editError)}</p>{/if}
        </li>
      {:else}
        <li class:moving={grabbedId === item.id || dragId === item.id}>
          <button
            class="grip"
            data-handle={item.id}
            aria-label={$t('menu.reorder')}
            aria-pressed={grabbedId === item.id}
            onkeydown={(e) => onHandleKey(e, item.id)}
            onpointerdown={(e) => onHandleDown(e, item.id)}
          >≡</button>
          <button class="entry" onclick={() => startEdit(item)}>
            <span class="name">{item.name}</span>
            <span class="price">{formatEuro(item.priceCents, $settings.symbolFirst)}</span>
          </button>
          <button
            class="cat"
            onclick={() => toggleCategory(item.id)}
            aria-label={item.category === 'food' ? $t('menu.cat-food') : $t('menu.cat-drink')}
          >
            {item.category === 'food' ? '🍽' : '🍺'}
          </button>
          <button class="del" onclick={() => remove(item.id)} aria-label={$t('menu.delete-item')}>✕</button>
        </li>
      {/if}
    {/each}
  </ul>

  <div class="add">
    <input placeholder={$t('menu.name')} bind:value={newName} />
    <input placeholder="4,50" inputmode="decimal" bind:value={newPrice} />
    <button
      class="cat"
      onclick={() => (newCategory = newCategory === 'food' ? 'drink' : 'food')}
      aria-label={newCategory === 'food' ? $t('menu.cat-food') : $t('menu.cat-drink')}
    >
      {newCategory === 'food' ? '🍽' : '🍺'}
    </button>
    <button onclick={add}>{$t('menu.add')}</button>
  </div>
  {#if error}<p class="error">{$t(error)}</p>{/if}
</main>

<style>
  .editor { max-width: 480px; margin: 0 auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
  h2 { display: flex; align-items: center; gap: 0.5rem; }
  .back { background: none; color: var(--cream); font-size: 1.4rem; }
  .toggle { display: flex; gap: 0.5rem; align-items: center; }
  input[type='checkbox'] { width: 24px; height: 24px; }
  .profiles { display: flex; gap: 0.4rem; }
  .profiles select {
    flex: 1; min-width: 0; padding: 0.5rem; border-radius: var(--radius);
    border: none; font: inherit; background: var(--cream); color: var(--ink);
  }
  .grip {
    background: none; color: var(--cream); opacity: 0.75;
    min-width: 32px; min-height: 40px; font-size: 1.2rem; line-height: 1;
    cursor: grab; touch-action: none; /* the handle drags, the page still scrolls */
  }
  .grip[aria-pressed='true'] { opacity: 1; color: var(--accent); }
  li.moving {
    background: var(--wood);
    outline: 2px solid var(--accent);
    box-shadow: var(--shadow);
  }
  .danger { background: var(--danger); color: var(--cream); }
  .danger:disabled { opacity: 0.4; }
  .rename { display: flex; gap: 0.5rem; align-items: center; font-size: 0.9rem; }
  .rename input {
    flex: 1; min-width: 0; padding: 0.5rem; border-radius: var(--radius);
    border: none; font: inherit; background: var(--cream); color: var(--ink);
  }
  .new-profile { display: flex; gap: 0.4rem; }
  .new-profile input {
    flex: 1; min-width: 0; padding: 0.6rem; border-radius: var(--radius);
    border: none; font: inherit; background: var(--cream); color: var(--ink);
  }
  .new-profile button { background: var(--wood-light); color: var(--cream); }
  .presets { display: flex; flex-direction: column; gap: 0.3rem; }
  .presets .label { font-size: 0.8rem; opacity: 0.7; }
  .preset-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .preset-row button { background: var(--wood-light); color: var(--cream); font-size: 0.85rem; }
  .io { display: flex; gap: 0.4rem; }
  .io button { flex: 1; background: var(--wood-light); color: var(--cream); }
  .hidden-file { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
  ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  li {
    display: flex; align-items: center; gap: 0.5rem;
    background: var(--wood-light); border-radius: var(--radius); padding: 0.4rem 0.6rem;
  }
  li span:first-child { flex: 1; }
  .price { font-variant-numeric: tabular-nums; }
  .del { background: var(--danger); color: var(--cream); min-width: 40px; min-height: 40px; }
  .cat { background: var(--wood-light); min-width: 44px; min-height: 40px; }
  .entry {
    flex: 1; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;
    background: none; color: var(--cream); text-align: left; min-height: 40px; padding: 0.2rem 0.3rem;
  }
  .entry .name { flex: 1; overflow-wrap: anywhere; }
  .entry:hover, .entry:focus-visible { background: rgb(255 255 255 / 0.08); border-radius: var(--radius); }
  li.editing { flex-wrap: wrap; }
  .edit-name, .edit-price {
    padding: 0.5rem; border-radius: var(--radius); border: none; font: inherit;
    background: var(--cream); color: var(--ink);
  }
  .edit-name { flex: 1; min-width: 0; }
  .edit-price { width: 5.5rem; }
  .ok { background: var(--ok); color: var(--cream); min-width: 40px; min-height: 40px; }
  .cancel { background: var(--danger); color: var(--cream); min-width: 40px; min-height: 40px; }
  .edit-error { flex-basis: 100%; margin: 0; }
  .add { display: flex; gap: 0.4rem; }
  .add input {
    flex: 1; min-width: 0; padding: 0.6rem; border-radius: var(--radius);
    border: none; font: inherit; background: var(--cream); color: var(--ink);
  }
  .add button { background: var(--ok); color: var(--cream); }
  .error { color: var(--danger); }
</style>
