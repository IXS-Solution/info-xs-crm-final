"""Create local-only browser QC fixtures; requires openpyxl, reportlab and Pillow."""
from pathlib import Path
from openpyxl import Workbook
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont
out=Path('/tmp/crm-qc-fixtures');out.mkdir(parents=True,exist_ok=True)
w=Workbook();ws=w.active;ws.append(['name','company','email','phone']);ws.append(['Excel Person','Excel Company','excel@qc.test','123456789']);w.save(out/'contacts.xlsx')
c=canvas.Canvas(str(out/'contacts.pdf'));t=c.beginText(60,750);t.setFont('Helvetica',18)
for line in ['PDF Person','PDF Company','pdf@qc.test','+92 300 1234567']:t.textLine(line)
c.drawText(t);c.save()
im=Image.new('RGB',(1200,600),'white');draw=ImageDraw.Draw(im);font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',40)
for i,line in enumerate(['Scanned Person','Scanned Company','scanned@qc.test','+92 300 1234567']):draw.text((60,60+i*100),line,font=font,fill='black')
im.save(out/'scanned.png');c=canvas.Canvas(str(out/'scanned.pdf'),pagesize=(800,400));c.drawImage(str(out/'scanned.png'),0,0,width=800,height=400);c.save()
