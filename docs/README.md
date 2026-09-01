# docs/ — the published privacy policy

`privacy-policy.html` is a standalone page. Google Play requires a **publicly
reachable** privacy policy URL for every app, entered in the Play Console under
*App content → Privacy policy*.

## Hosting it

Either is fine; the second is preferable for an official CICT publication.

**GitHub Pages** — repo → Settings → Pages → Source: *Deploy from a branch*,
branch `main`, folder `/docs`. The policy is then at
`https://<org>.github.io/<repo>/privacy-policy.html`.

**cict.in** — copy the single file onto the CICT web server. It has no
dependencies except the Google Fonts stylesheet and degrades cleanly without it.

## Before publishing

1. Fill the two placeholders marked in red: the postal address and the official
   contact email.
2. Have CICT's competent authority approve the text. It was drafted from a
   technical audit of the app, not by a lawyer.
3. Keep it in step with the app: if a release changes what is collected or
   transmitted, update the policy and its effective date **before** that release
   goes out. The current text describes version 1.2 (build 3).
