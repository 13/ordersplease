import { mount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'
import './app.css'
import App from './App.svelte'
import { updateReady, setUpdater } from './stores/update'

const updateSW = registerSW({
  onNeedRefresh() {
    updateReady.set(true);
  },
});
setUpdater(() => updateSW(true));

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
