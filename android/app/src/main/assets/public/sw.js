/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-970124e6'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "17fdab05f7f279dde23c50f55cbf28c5"
  }, {
    "url": "pwa-512x512.png",
    "revision": "7b246846ed057b97be37833bc6cc7de9"
  }, {
    "url": "pwa-192x192.png",
    "revision": "4c60147b6bc64837420577723efb2616"
  }, {
    "url": "index.html",
    "revision": "2778b4c78f5f1f9797b1252651a6879e"
  }, {
    "url": "icon.svg",
    "revision": "97c0a772a33c45a1e9c0a6859a9346c1"
  }, {
    "url": "generator.html",
    "revision": "095e1fc5e19cd0778f8e6bdd54c7cc34"
  }, {
    "url": "favicon.ico",
    "revision": "f5834ca2cb102e6ef450d1abb6f8370a"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "fad50ee1f9b081e9229987bb0867f76a"
  }, {
    "url": "assets/index-DYGZoJmK.js",
    "revision": null
  }, {
    "url": "assets/index-C5FlllC3.css",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "fad50ee1f9b081e9229987bb0867f76a"
  }, {
    "url": "favicon.ico",
    "revision": "f5834ca2cb102e6ef450d1abb6f8370a"
  }, {
    "url": "icon.svg",
    "revision": "97c0a772a33c45a1e9c0a6859a9346c1"
  }, {
    "url": "pwa-192x192.png",
    "revision": "4c60147b6bc64837420577723efb2616"
  }, {
    "url": "pwa-512x512.png",
    "revision": "7b246846ed057b97be37833bc6cc7de9"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "17fdab05f7f279dde23c50f55cbf28c5"
  }, {
    "url": "manifest.webmanifest",
    "revision": "ffaf378afae36f6a607d55b4904073c5"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/api\.open-meteo\.com\/.*/i, new workbox.NetworkFirst({
    "cacheName": "weather-api-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 30,
      maxAgeSeconds: 21600
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
