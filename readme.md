# Overview

Sample Single-Page Web App (SPA) for Okta OpenID Connect (OIDC)

## Sample Scenarios

### OpenID Connect with Custom UI

You can find the main javascript code in `/js/oidc-app.js` and html in `oidc.html`

This sample demonstrates the OpenID Connect implicit flow:

- Sign in with Password: Authenticates user with [name/password](http://developer.okta.com/docs/api/resources/authn.html#primary-authentication-with-public-application) and exchanges a [sessionToken](http://developer.okta.com/docs/api/resources/authn.html#session-token) for an `id_token` (JWT) using a hidden iframe
- Sign in with IdP: Authenticates user by [redirecting to an external Identity Provider (IdP)](http://developer.okta.com/docs/api/resources/social_authentication.html) such as Facebook in a popup window and returns an `id_token` (JWT) for the user via a hidden iframe
- Refresh Token: Uses the current session with Okta to obtain a new id_token (JWT) via a hidden iframe
- Request Protected Resource (API): Uses the `id_token` as an OAuth2 Bearer Access Token to request a protected resources from an API (you must first authenticate)

These scenarios are enabled by the `okta_post_message` custom `response_mode` for the [OpenID Connect Authentication Request](http://openid.net/specs/openid-connect-core-1_0.html#AuthRequest) which uses [HTML5 Window Messaging] (https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) and a hidden iframe to return the [id_token]  (http://openid.net/specs/openid-connect-core-1_0.html#AuthResponse) to the Single Page Web App (SPA) without refreshing or redirecting the page.

See [postMessageCallback](https://github.com/mcguinness/okta-oidc-sample/blob/master/js/OktaAuthRequireJquery.js#L1118) for implementation details of how the `okta_post_message` response_mode works

#### OpenID Connect with Okta Sign-In Widget

This sample demonstrates the OpenID Connect implicit flow with the Okta Sign-In Widget

You can find the main javascript code and html in `/js/widget-app.js` and html in `widget.html`

## Prerequisites

1. Install [node.js and npm](https://nodejs.org/en/download/) on your developer machine
2. Clone this Github repository to a local working directory
3. Run `npm install` from your local working directory to install all dependencies

## Setup

> This document assumes you host this app on `http://localhost:8080/`

1. Grant the app [CORS access](http://developer.okta.com/docs/api/getting_started/enabling_cors.html) in your Okta organization (e.g. `http://localhost:8080/`)

2. Create OpenID Connect Application in the Okta Admin UI

    1. Applications>Add Application
    2. Click the **"Create New App"** button
    3. Select **"Single Page App (SPA)"** as the Platform
    4. Select **"OpenID Connect"** and click the "Create" button
    5. Enter a name for the application such as "Sample OIDC App" and click **"Next"**
    6. Add the following redirect URIs and click **"Finish"**
       ```
       http://localhost:8080/
       http://localhost:8080/oidc
       http://localhost:8080/oidc.html
       http://localhost:8080/widget.html
       ```
    7. Copy the **"Client ID"** for your new application
    8. Navigate to the **Groups** tab for the application and assign to the **Everyone** group

3. Update `/js/config.js` with your Okta organization URL and the **"Client ID"** you copied from your OIDC Application in step 7

    ```javascript
    return {
      orgUrl: 'https://example.oktapreview.com',
      clientId: 'ANRZhyDh8HBFN5abN6Rg'
    };
    ```

4. Install npm packages with `npm install`

5. Start Web Server with `npm start`

6. Visit `http://localhost:8080/oidc.html` to launch the "OpenID Connect Sample App"

7. Visit `http://localhost:8080/widget.html` to launch the "Okta Sign-In Widget Sample App"

## Social Authentication

The Okta Sign-In Widget also supports Social Authentication.  You need to first add a Social IdP via the Okta Admin UI and obtain the `id` for the IdP which is found in the **Authorize URL** such as https://example.okta.com/oauth2/v1/authorize?idp=**0oabzpziblMwBLLqO0g4**.

When initializing the the widget you then add the IdP as an additional param with the `id` and `type` (e.g. `FACEBOOK`, `GOOGLE`, or `LINKEDIN`) which controls the branding of the button

```javascript
oktaSignIn.renderEl(
{
  idps: [
    {
      type: 'FACEBOOK',
      id: '0oa5kecjfwuF4HQ4w0h7'
    }
  ]
}
```

### Extending Social User Profiles with Callouts

The sample application supports extending the user profile created via Social Authentication with a callout.

#### API Token

Update `/js/config.js` with an [API Token](https://developer.okta.com/docs/api/getting_started/getting_a_token.html) for your Okta Organization

#### Social IdP Configuration

1. Navigate to Security->Identity Providers
2. Select your Identity Provider and click **Configure Identity Provider** in the **Configure** drop-down
3. Select **Callout** in the **Provisioning Policy** drop-down
4. Enter `http://localhost:8080/social/callback` for **Provisioning Callout URI**
5. Select **HTTP-Redirect** in the **Provisioning Callout Binding** drop-down
6. Click **Update Identity Provider** to save your changes

> Ensure that "Update attributes for existing users" is not checked for profile mastering.

#### Adding Custom Attribute & Mappings

1. Navigate to Directory->Profile Editor
2. Click **Profile** button for Okta User Profile
3. Click **Add Attribute**
4. Add the following properties and click **"Save"**
    - Display name: Customer ID
    - Variable name: customerId
5. Go back to the Profile Editor via Directory->Profile Editor
6. Select your OpenID Connect application and click **Profile** button
7. Click **Add Attribute**
8. Add the following properties and click **"Save"**
    - Display name: Customer ID
    - Variable name: customerId
    - Scope: [X] User personal
9. Click **Map Attributes**
10. Add a new mapping for the `customerId` attribute and select the `customerId` attribute from the Okta User profile
11. Change the mapping from "Apply mapping on user create only" to "Apply mapping on user create or update"
12. Click **Save Mappings**
13. Click **Apply Updates Now**
