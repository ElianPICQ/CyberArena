# TP JWT + MongoDB vulnérable

Application NodeJS + Express + MongoDB volontairement vulnérable pour un TP de cybersécurité en environnement local.

## Lancement

```bash
docker compose up --build
```

Puis ouvrir :

```txt
http://localhost:3000
```


## Remise à zéro de la base

```bash
docker compose down -v
docker compose up --build
```

## Note sécurité

Ce projet est volontairement vulnérable. Il doit rester en local ou sur un réseau de lab isolé.
Ne pas exposer sur Internet.
