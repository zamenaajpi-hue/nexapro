# Windows code signing

NEXA Windows releases must be built with a trusted Authenticode Code Signing certificate.
Do not add a certificate file or its password to the repository.

## PFX/P12 certificate

Run PowerShell in the project directory:

```powershell
$env:CSC_LINK = 'C:\secure\nexa-code-signing.pfx'
$env:CSC_KEY_PASSWORD = 'certificate-password'
npm.cmd run desktop:build:signed
```

`CSC_LINK` can also contain the base64 value supported by electron-builder.

## Certificate from the Windows certificate store

The certificate must be in `Cert:\CurrentUser\My`, contain a private key, and have the
Code Signing enhanced key usage.

```powershell
$env:NEXA_WINDOWS_CERT_SHA1 = 'CERTIFICATE_THUMBPRINT'
npm.cmd run desktop:build:signed
```

The script builds the web/server bundle, creates the NSIS and portable Windows packages,
then rejects the release unless every generated EXE has a valid Authenticode signature.

## CI secrets

Store `CSC_LINK` and `CSC_KEY_PASSWORD` as protected CI secrets. Never print them in logs.
