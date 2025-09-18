# python-service/app.py
from flask import Flask, request, send_file
from rembg import remove
from PIL import Image
import io

app = Flask(__name__)

@app.route('/remove-bg', methods=['POST'])
def remove_background():
    """
    Flask route to handle background removal.
    Expects a multipart/form-data request with an 'image' file.
    Returns the processed image as a PNG file with a transparent background.
    """
    if 'image' not in request.files:
        return "No image file provided", 400

    file = request.files['image']
    
    # Check if the file is empty
    if file.filename == '':
        return "No selected file", 400

    try:
        input_image = Image.open(file.stream)
        
        # Convert image to bytes
        input_bytes = io.BytesIO()
        input_image.save(input_bytes, format=input_image.format or 'PNG')
        input_bytes.seek(0)

        # Remove the background
        output_bytes = remove(input_bytes.read())

        # Send the processed image back
        return send_file(
            io.BytesIO(output_bytes),
            mimetype='image/png',
            as_attachment=True,
            download_name='background_removed.png'
        )
    except Exception as e:
        print(f"Error processing image: {e}")
        return "Error processing image", 500

if __name__ == '__main__':
    # Running on 0.0.0.0 makes it accessible from the Node.js container
    app.run(host='0.0.0.0', port=5001)
