(async function resetShelfMarginPreviewCache() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    if (!sessionStorage.getItem("shelfmargin-preview-cache-reset")) {
      sessionStorage.setItem("shelfmargin-preview-cache-reset", "1");
      window.location.reload();
    }
  } catch (error) {
    console.warn("[ShelfMargin] preview cache reset failed", error);
  }
})();
