# Security policy

The Trigger is a static site built from files in this repository. It has no server, no accounts, no database and no user input beyond the calculator, which runs in the browser and sends nothing anywhere.

The parts worth attacking are the build pipeline and the data:

- the GitHub Actions workflows and the secrets they hold (API keys for Congress.gov, FRED, BLS, LegiScan, and the SEC contact string),
- the dependencies installed during the build,
- anything that could get a false number published under the project's name.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: the **Security** tab of this repository, then **Report a vulnerability**. Please do not open a public issue for anything that could be exploited.

Include what you found, how to reproduce it, and what an attacker could do with it. You should get a first response within a week.

## A wrong number is not a security issue

If a published value is wrong, open a normal issue with the "Data correction" form. Corrections are published as a new snapshot revision; past files are never rewritten.

## Supported versions

Only the `main` branch is deployed and supported.
