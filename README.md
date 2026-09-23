# Elevate HR

A local recruitment dashboard for storing job descriptions and candidate details, then reviewing a transparent ranking based on required skills, years of experience, and description terms.

## Run on Ubuntu

Install Node.js 20+ and npm, then:

```bash
cd elevate-hr
npm install
npm start
```

Open http://localhost:3000. The SQLite database (`elevatehr.db`) is created automatically from `schema.sql` and ignored by Git.

Add a role with required skills, add candidate details or paste resume text, then select a role to see the ranked shortlist. Status changes are saved. The ranking formula is 70% skill overlap, 20% minimum experience, 10% description word overlap. It is a basic, explainable comparison, not an AI assessment or an automatic hiring decision. Review every application yourself.

This starter has no user accounts or access control. Use only on your own computer with sample or consented data. Add authentication, role permissions, secure document storage, and privacy controls before exposing it online or storing real applicant records.

## GitHub

```bash
git init
git branch -M main
git add .
git commit -m "Initial commit: Elevate HR"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```
