Files that go here are expected to use APIs that are available in all JS contexts.

Unfortunately, typescript has no way of knowing. Therefore, this folder is declared as "worker" as it is the smallest API surface.

Note that this (or any lib/ subfolder) isn't a referenced project in the root tsconfig.json as it's pulled by files in public/

When compiling, tsc will check that you don't use unavailable APIs.
