# Certificados

`sectigo-dv-r36.pem` es el certificado **intermedio público** "Sectigo Public Server Authentication CA DV R36".

El servidor de `ctt-talleresfisei.uta.edu.ec` envía solo su certificado hoja, sin el intermedio (cadena incompleta). Windows completa la cadena por su cuenta, pero Node en Linux (Render) falla con `fetch failed`. El script `start:prod` lo añade con `NODE_EXTRA_CA_CERTS`, así que no hace falta desactivar la verificación TLS.
