import { register } from "node:module";
import { pathToFileURL } from "node:url";

/**
 * Let a test import an app module that imports other app modules.
 *
 * App code is compiled by Next, which resolves "./tr" the way a bundler does.
 * Node's ESM loader does not guess extensions, so the first test to reach a
 * module with its own imports failed on ERR_MODULE_NOT_FOUND — which would have
 * meant either giving up on testing anything that shares a helper, or flattening
 * the app's imports to suit the test runner. This hook appends the extension the
 * bundler would have found, and only for specifiers that resolve no other way.
 */
register("./tsResolve.hooks.mjs", pathToFileURL(import.meta.filename));
