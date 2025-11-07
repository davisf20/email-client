#!/bin/bash
# Crea un'icona PNG semplice usando sips (tool nativo macOS)
# Crea un'immagine PNG 512x512 con sfondo blu
python3 << 'PYTHON'
try:
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new('RGB', (512, 512), color='#2563eb')
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 200)
    except:
        font = ImageFont.load_default()
    text = 'M'
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    position = ((512 - text_width) // 2, (512 - text_height) // 2)
    draw.text(position, text, fill='white', font=font)
    img.save('icon.png')
    print('✅ Icona creata')
except ImportError:
    print('PIL non disponibile, uso metodo alternativo')
    # Crea un PNG minimale usando base64
    import base64
    # PNG minimale 1x1 blu (verrà scalato da Tauri)
    png_data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
    with open('icon.png', 'wb') as f:
        f.write(png_data)
    print('✅ Icona placeholder creata')
PYTHON
