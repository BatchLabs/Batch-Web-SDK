# Batch SDK - Web

This documentation describe Batch SDK's public API.

Once you've called `batchSDK("setup", {...})`, the public API can be accessed.

You can get the PublicAPI implementation
by calling the global `batchSDK` method:

```
window.batchSDK(api => { ... })

or

window.batchSDK(function(api) {
    ...
});
```

Example: Fetching your Installation ID, using
getInstallationID:

```
window.batchSDK(api => api.getInstallationID().then(console.log))
```

Note that methods are also available in an alternate call style, where the first
argument to `batchSDK()` is the method name.

Subsequent arguments are forwarded to the public API method.

Example: Forcibly showing an UI component
(ui.show) with both API call styles:

```
window.batchSDK(api => api.ui.show("alert", true));

or

window.batchSDK("ui.show", "alert", true);
```
