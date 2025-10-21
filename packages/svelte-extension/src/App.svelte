<script lang="ts">
  import Counter from './lib/Counter.svelte';
  import { _http } from 'vtzac';
  import { AppController } from 'browser-api/src/app.controller';
  import { getApiBaseUrl } from './config';

  let hello: string = '';
  let loading = false;
  let error: string | null = null;

  async function fetchHello() {
    loading = true;
    error = null;
    try {
      const api = _http({
        ofetchOptions: {
          baseURL: getApiBaseUrl(),
          timeout: 5000,
        },
      }).controller(AppController);
      const res = await api.getHello();
      // vtzac 响应包装，类型安全访问
      hello = String(res._data ?? '');
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }
</script>

<main>
  <Counter />
  <section style="margin-top: 16px;">
    <button on:click={fetchHello} disabled={loading}>
      {loading ? '请求中...' : '调用后端: getHello()'}
    </button>
    {#if error}
      <p style="color: red;">错误：{error}</p>
    {/if}
    {#if hello}
      <p>后端响应：{hello}</p>
    {/if}
  </section>
</main>
