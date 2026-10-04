"use strict";

const CACHE_NAME =
  "ez-media-executive-v108";

const APP_SHELL = [
  "/executive-command-center/mobile/",
  "/executive-command-center/mobile/index.html",
  "/executive-command-center/mobile/app.js",
  "/executive-command-center/mobile/styles.css",
  "/executive-command-center/mobile/manifest.json"
];

self.addEventListener(
  "install",
  event => {

    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then(cache =>
          cache.addAll(APP_SHELL)
        )
    );

    self.skipWaiting();
  }
);

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(
      caches.keys()
        .then(keys =>
          Promise.all(
            keys
              .filter(
                key =>
                  key !== CACHE_NAME
              )
              .map(
                key =>
                  caches.delete(key)
              )
          )
        )
    );

    self.clients.claim();
  }
);

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;

    if (
      request.method !== "GET"
    ) {
      return;
    }

    const url =
      new URL(request.url);

    if (
      url.pathname.startsWith(
        "/api/"
      )
    ) {
      event.respondWith(
        fetch(request)
          .catch(
            () =>
              new Response(
                JSON.stringify({
                  success: false,
                  offline: true
                }),
                {
                  headers: {
                    "Content-Type":
                      "application/json"
                  }
                }
              )
          )
      );

      return;
    }

    event.respondWith(
      caches.match(request)
        .then(
          cached =>
            cached ||
            fetch(request)
              .then(response => {

                const clone =
                  response.clone();

                caches
                  .open(
                    CACHE_NAME
                  )
                  .then(cache =>
                    cache.put(
                      request,
                      clone
                    )
                  );

                return response;

              })
              .catch(
                () =>
                  caches.match(
                    "/executive-command-center/mobile/index.html"
                  )
              )
        )
    );
  }
);
