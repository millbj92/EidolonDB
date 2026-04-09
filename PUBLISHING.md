# Publishing SDKs

## JS SDK (@eidolondb/client)

1. Bump version in `packages/sdk-js/package.json`
2. Tag and push: `git tag sdk-js-v<version> && git push origin sdk-js-v<version>`
3. GitHub Actions publishes to npm automatically.

Requires `NPM_TOKEN` secret in GitHub (repo Settings -> Secrets -> Actions).
Get token from: npmjs.com -> Access Tokens -> Generate New Token -> Automation.

## Python SDK (eidolondb)

1. Bump version in `packages/sdk-python/pyproject.toml`
2. Tag and push: `git tag sdk-python-v<version> && git push origin sdk-python-v<version>`
3. GitHub Actions publishes to PyPI automatically.

Requires `PYPI_TOKEN` secret in GitHub (repo Settings -> Secrets -> Actions).
Get token from: pypi.org -> Account Settings -> API tokens -> Add API token -> scope to eidolondb project.
