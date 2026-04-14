"""
Generate the VM partitioning specification document for ARIS Academy.
"""
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def set_cell_shading(cell, color_hex: str):
    """Apply background shading to a table cell."""
    shading = cell._element.get_or_add_tcPr()
    shd = shading.makeelement(qn('w:shd'), {
        qn('w:val'): 'clear',
        qn('w:color'): 'auto',
        qn('w:fill'): color_hex,
    })
    shading.append(shd)


def style_header_row(row, bg_color='1B3A5C'):
    """Style a table header row."""
    for cell in row.cells:
        set_cell_shading(cell, bg_color)
        for paragraph in cell.paragraphs:
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in paragraph.runs:
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.bold = True
                run.font.size = Pt(9)


def add_data_row(table, values, bold_col=None, highlight=None):
    """Add a data row to a table."""
    row = table.add_row()
    for i, val in enumerate(values):
        cell = row.cells[i]
        p = cell.paragraphs[0]
        run = p.add_run(str(val))
        run.font.size = Pt(9)
        if bold_col is not None and i == bold_col:
            run.font.bold = True
        if highlight and i in highlight:
            run.font.color.rgb = RGBColor(0x1B, 0x3A, 0x5C)
            run.font.bold = True
    if highlight and 'row_bg' in highlight:
        for cell in row.cells:
            set_cell_shading(cell, highlight['row_bg'])
    return row


def set_table_style(table):
    """Apply consistent styling to a table."""
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for row in table.rows:
        for cell in row.cells:
            cell.paragraphs[0].paragraph_format.space_before = Pt(2)
            cell.paragraphs[0].paragraph_format.space_after = Pt(2)


# ---------------------------------------------------------------------------
# Document creation
# ---------------------------------------------------------------------------

doc = Document()

# Page margins
for section in doc.sections:
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)

# ── Title ──
title = doc.add_heading('', level=0)
run = title.add_run('ARIS Academy — Partitionnement Disque')
run.font.color.rgb = RGBColor(0x1B, 0x3A, 0x5C)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER

subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = subtitle.add_run('Spécifications d\'installation Ubuntu pour les VMs de production')
run.font.size = Pt(12)
run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

# Metadata line
meta = doc.add_paragraph()
meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = meta.add_run('AU-IBAR  |  learning.au-ibar.org  |  Mars 2026')
run.font.size = Pt(9)
run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
run.font.italic = True

doc.add_paragraph('')

# ── Recap VMs ──
doc.add_heading('1. Récapitulatif des VMs', level=1)

recap_table = doc.add_table(rows=1, cols=6)
recap_table.style = 'Table Grid'
hdr = recap_table.rows[0]
for i, text in enumerate(['VM', 'Rôle', 'vCPU', 'RAM', 'Stockage', 'OS']):
    hdr.cells[i].paragraphs[0].add_run(text)
style_header_row(hdr)

add_data_row(recap_table, ['VM-ACADEMY', 'Plateforme e-learning (Docker, microservices, BDD, stockage)', '8', '32 GB', '300 GB', 'Ubuntu 22.04 LTS'])
add_data_row(recap_table, ['VM-BBB', 'BigBlueButton (visioconférence enseignement)', '8', '16 GB', '200 GB', 'Ubuntu 22.04 LTS'])

# Total row
total_row = recap_table.add_row()
total_row.cells[0].paragraphs[0].add_run('TOTAL').bold = True
total_row.cells[1].paragraphs[0].add_run('')
total_row.cells[2].paragraphs[0].add_run('16').bold = True
total_row.cells[3].paragraphs[0].add_run('48 GB').bold = True
total_row.cells[4].paragraphs[0].add_run('500 GB').bold = True
total_row.cells[5].paragraphs[0].add_run('')
for cell in total_row.cells:
    set_cell_shading(cell, 'F0F4F8')
    for run in cell.paragraphs[0].runs:
        run.font.size = Pt(9)

set_table_style(recap_table)

doc.add_paragraph('')

# ══════════════════════════════════════════════════════════════════════════
# VM-ACADEMY
# ══════════════════════════════════════════════════════════════════════════

doc.add_heading('2. VM-ACADEMY — Partitionnement (300 GB)', level=1)

desc = doc.add_paragraph()
run = desc.add_run('Cette VM héberge l\'ensemble de la plateforme via Docker Compose : ')
run.font.size = Pt(10)
run = desc.add_run('PostgreSQL 16, Redis 7, Apache Kafka, MinIO, Traefik v3, 4 microservices Fastify, Frontend Next.js.')
run.font.size = Pt(10)
run.font.italic = True

# Table
vm1_table = doc.add_table(rows=1, cols=5)
vm1_table.style = 'Table Grid'
hdr = vm1_table.rows[0]
for i, text in enumerate(['Partition', 'Point de montage', 'Taille', 'Filesystem', 'Justification']):
    hdr.cells[i].paragraphs[0].add_run(text)
style_header_row(hdr)

vm1_data = [
    ['/dev/sda1', '/boot/efi',               '1 GB',   'FAT32 (EFI)',         'Bootloader UEFI'],
    ['/dev/sda2', '/boot',                    '2 GB',   'ext4',                'Kernels, initramfs, GRUB'],
    ['/dev/sda3', '/',                        '30 GB',  'ext4',                'Système, binaires, configuration'],
    ['/dev/sda4', '/var',                     '20 GB',  'ext4',                'Logs système, caches APT, spool'],
    ['/dev/sda5', '/var/lib/docker',          '120 GB', 'ext4',                'Images Docker, containers, layers, build cache'],
    ['/dev/sda6', '/var/lib/docker/volumes',  '100 GB', 'ext4',                'Volumes persistants : PostgreSQL, Redis, Kafka, MinIO'],
    ['/dev/sda7', '/tmp',                     '5 GB',   'ext4 (noexec,nosuid)','Fichiers temporaires isolés'],
    ['/dev/sda8', 'swap',                     '8 GB',   'swap',                'Swap — 25% de 32 GB RAM'],
    ['/dev/sda9', '/home',                    '14 GB',  'ext4',                'Home utilisateurs, scripts déploiement'],
]

for row_data in vm1_data:
    add_data_row(vm1_table, row_data, bold_col=1)

# Total row
total = vm1_table.add_row()
total.cells[0].paragraphs[0].add_run('')
total.cells[1].paragraphs[0].add_run('TOTAL').bold = True
run = total.cells[2].paragraphs[0].add_run('300 GB')
run.bold = True
run.font.size = Pt(9)
total.cells[3].paragraphs[0].add_run('')
total.cells[4].paragraphs[0].add_run('')
for cell in total.cells:
    set_cell_shading(cell, 'E8F0FE')
    for r in cell.paragraphs[0].runs:
        r.font.size = Pt(9)

set_table_style(vm1_table)

doc.add_paragraph('')

# ══════════════════════════════════════════════════════════════════════════
# VM-BBB
# ══════════════════════════════════════════════════════════════════════════

doc.add_heading('3. VM-BBB — Partitionnement (200 GB)', level=1)

desc = doc.add_paragraph()
run = desc.add_run('BigBlueButton : plateforme de visioconférence open source pour l\'enseignement. ')
run.font.size = Pt(10)
run = desc.add_run('Inclut Nginx, FreeSWITCH (audio), Kurento (vidéo WebRTC), et le moteur d\'enregistrement/playback.')
run.font.size = Pt(10)
run.font.italic = True

# Table
vm2_table = doc.add_table(rows=1, cols=5)
vm2_table.style = 'Table Grid'
hdr = vm2_table.rows[0]
for i, text in enumerate(['Partition', 'Point de montage', 'Taille', 'Filesystem', 'Justification']):
    hdr.cells[i].paragraphs[0].add_run(text)
style_header_row(hdr)

vm2_data = [
    ['/dev/sda1', '/boot/efi',            '1 GB',   'FAT32 (EFI)',          'Bootloader UEFI'],
    ['/dev/sda2', '/boot',                '2 GB',   'ext4',                 'Kernels, initramfs, GRUB'],
    ['/dev/sda3', '/',                    '30 GB',  'ext4',                 'Système + paquets BBB (Nginx, FreeSWITCH, Kurento)'],
    ['/dev/sda4', '/var',                 '15 GB',  'ext4',                 'Logs Nginx, BBB, FreeSWITCH'],
    ['/dev/sda5', '/var/bigbluebutton',   '120 GB', 'ext4',                 'Enregistrements vidéo, présentations, playback'],
    ['/dev/sda6', '/tmp',                 '10 GB',  'ext4 (noexec,nosuid)', 'Transcodage vidéo temporaire (conversion, mux)'],
    ['/dev/sda7', 'swap',                 '8 GB',   'swap',                 'Swap — 50% de 16 GB RAM'],
    ['/dev/sda8', '/home',                '14 GB',  'ext4',                 'Home utilisateurs, scripts maintenance'],
]

for row_data in vm2_data:
    add_data_row(vm2_table, row_data, bold_col=1)

# Total row
total = vm2_table.add_row()
total.cells[0].paragraphs[0].add_run('')
total.cells[1].paragraphs[0].add_run('TOTAL').bold = True
run = total.cells[2].paragraphs[0].add_run('200 GB')
run.bold = True
run.font.size = Pt(9)
total.cells[3].paragraphs[0].add_run('')
total.cells[4].paragraphs[0].add_run('')
for cell in total.cells:
    set_cell_shading(cell, 'E8F0FE')
    for r in cell.paragraphs[0].runs:
        r.font.size = Pt(9)

set_table_style(vm2_table)

doc.add_paragraph('')

# ══════════════════════════════════════════════════════════════════════════
# NOTES
# ══════════════════════════════════════════════════════════════════════════

doc.add_heading('4. Recommandations d\'installation', level=1)

notes = [
    ('LVM obligatoire', 'Utiliser LVM (Logical Volume Manager) sur les deux VMs pour pouvoir redimensionner les partitions à chaud sans réinstallation. Sélectionner « Guided — use entire disk and set up LVM » lors de l\'installation Ubuntu.'),
    ('Option noatime', 'Ajouter l\'option noatime sur toutes les partitions ext4 dans /etc/fstab pour réduire les écritures disque et améliorer les performances I/O.'),
    ('Swap modéré', 'Le swap est volontairement limité (8 GB) car les deux VMs disposent de suffisamment de RAM. Éviter le swapping excessif qui dégraderait les performances.'),
    ('VM-ACADEMY : Docker', '/var/lib/docker (120 GB) et /var/lib/docker/volumes (100 GB) sont séparés pour que les données persistantes (PostgreSQL, MinIO) ne saturent pas l\'espace des images/layers Docker. Alternative simplifiée : fusionner en un seul /var/lib/docker de 220 GB.'),
    ('VM-BBB : Enregistrements', '/var/bigbluebutton (120 GB) est la partition critique. C\'est là que BBB stocke tous les enregistrements (published, unpublished), les présentations uploadées et les fichiers de playback. Prévoir un monitoring d\'espace disque.'),
    ('VM-BBB : /tmp', '/tmp est dimensionné à 10 GB car BigBlueButton y effectue le transcodage vidéo temporaire avant de déplacer les fichiers finaux dans /var/bigbluebutton.'),
    ('Sécurité /tmp', 'Monter /tmp avec les options noexec,nosuid,nodev sur les deux VMs pour empêcher l\'exécution de binaires depuis le répertoire temporaire.'),
    ('Monitoring', 'Mettre en place des alertes d\'espace disque (seuil 80%) sur les partitions critiques : /var/lib/docker/volumes (VM-ACADEMY) et /var/bigbluebutton (VM-BBB).'),
]

for title_text, body_text in notes:
    p = doc.add_paragraph()
    run = p.add_run(f'  {title_text} : ')
    run.bold = True
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(0x1B, 0x3A, 0x5C)
    run = p.add_run(body_text)
    run.font.size = Pt(10)

doc.add_paragraph('')

# ── Visual Diagram ──
doc.add_heading('5. Schéma visuel', level=1)

diagram_vm1 = """
VM-ACADEMY (300 GB)
+------------+--------+------------+----------+--------------------+------------------------+---------+--------+---------+
| /boot/efi  | /boot  |     /      |  /var    | /var/lib/docker    | /var/lib/docker/volumes |  /tmp   |  swap  |  /home  |
|   1 GB     |  2 GB  |   30 GB    |  20 GB   |     120 GB         |       100 GB            |  5 GB   |  8 GB  |  14 GB  |
+------------+--------+------------+----------+--------------------+------------------------+---------+--------+---------+
"""

diagram_vm2 = """
VM-BBB (200 GB)
+------------+--------+------------+----------+---------------------+---------+--------+---------+
| /boot/efi  | /boot  |     /      |  /var    | /var/bigbluebutton  |  /tmp   |  swap  |  /home  |
|   1 GB     |  2 GB  |   30 GB    |  15 GB   |      120 GB         |  10 GB  |  8 GB  |  14 GB  |
+------------+--------+------------+----------+---------------------+---------+--------+---------+
"""

for diagram in [diagram_vm1, diagram_vm2]:
    p = doc.add_paragraph()
    run = p.add_run(diagram.strip())
    run.font.name = 'Courier New'
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
    doc.add_paragraph('')

# ── Footer ──
doc.add_paragraph('')
footer = doc.add_paragraph()
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = footer.add_run('AU-IBAR — ARIS Academy Infrastructure Team — Mars 2026')
run.font.size = Pt(8)
run.font.color.rgb = RGBColor(0xAA, 0xAA, 0xAA)
run.font.italic = True

# ── Save ──
output_path = r'C:\learn.au-aris.org\ARIS_Academy_Partitionnement_VMs.docx'
doc.save(output_path)
print(f'Document saved to: {output_path}')
