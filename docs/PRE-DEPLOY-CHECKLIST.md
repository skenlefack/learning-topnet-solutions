# Pre-Deployment Checklist — ARIS Academy

## GitHub Secrets Required

| Secret | Description | How to get |
|--------|-------------|-----------|
| `VM_ACADEMY_HOST` | IP de VM-ACADEMY | `10.202.101.144` |
| `VM_ACADEMY_USER` | SSH user | `deploy` ou `root` |
| `VM_SSH_KEY` | Clef SSH privee | `ssh-keygen` puis ajouter pub sur VM |
| `VM_ACADEMY_PASSWORD` | (optionnel si key) | Mot de passe SSH |
| `CI_REGISTRY` | (optionnel) | Default: `ghcr.io` |
| `CI_REGISTRY_IMAGE` | (optionnel) | Default: `ghcr.io/<owner>/aris-academy` |

## .env.production — Secrets a recuperer

| Variable | Source | Action |
|----------|--------|--------|
| `BBB_SECRET` | VM-BBB | `ssh vm-bbb "cat /etc/bigbluebutton/bbb-web-config \| grep securitySalt"` |
| `ARIS_SSO_CLIENT_SECRET` | ARIS Core Admin | Demander a l'equipe ARIS Core |
| `SMTP_PASSWORD` | IT Admin | Mot de passe pour `lms-alerts@au-ibar.org` |

## VM-ACADEMY — Setup initial (une seule fois)

```bash
# 1. Installer Docker + docker compose
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y

# 2. Cloner le repo
git clone <repo-url> /opt/aris-academy
cd /opt/aris-academy

# 3. Copier .env.production -> .env
cp .env.production .env
# Remplir les 3 secrets manquants

# 4. Creer les reseaux Docker
docker network create academy-net || true

# 5. Premier deploiement
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 6. Installer les crons de backup
cp infra/scripts/backup-cron.conf /etc/cron.d/aris-backup
chmod 644 /etc/cron.d/aris-backup

# 7. Verifier la sante
./infra/scripts/health-check.sh
```

## DNS

| Domaine | Type | Valeur |
|---------|------|--------|
| `learning.au-ibar.org` | A | `10.202.101.144` (IP publique VM-ACADEMY) |

## Verification post-deploiement

- [ ] `https://learning.au-ibar.org/login` charge la page de login
- [ ] `https://learning.au-ibar.org/api/courses/health` retourne `{"status":"ok"}`
- [ ] `https://learning.au-ibar.org/api/learning/health` retourne `{"status":"ok"}`
- [ ] `https://learning.au-ibar.org/api/assessment/health` retourne `{"status":"ok"}`
- [ ] `https://learning.au-ibar.org/api/live/health` retourne `{"status":"ok"}`
- [ ] Certificat TLS valide (Let's Encrypt)
- [ ] Login avec credentials de demo fonctionne
- [ ] Dashboard charge les donnees
- [ ] Grafana accessible a `https://learning.au-ibar.org/grafana`
- [ ] Backup cron actif : `crontab -l | grep aris`

## Rollback

```bash
cd /opt/aris-academy
# Revenir au commit precedent
git log --oneline -5
git checkout <previous-sha>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
