// frontend/public/js/edit.js
function imageUploader() {
    return {
        dragging: false,
        images: [], // Holds { url, file, serverPath, originalUrl, editedUrl }
        showModal: false,
        editingImage: { url: '', index: -1 },
        cropper: null,
        aspectRatio: 'free',
        flipX: 1,
        flipY: 1,
        isLoading: false,
        pendingReset: false, // Track if reset is pending in modal

        handleFileSelect(event) {
            this.addFiles(event.target.files);
        },

        handleDrop(event) {
            this.dragging = false;
            this.addFiles(event.dataTransfer.files);
        },

        addFiles(files) {
            const fileList = Array.from(files).filter(file => file.type.startsWith('image/'));
            if (fileList.length === 0) return;

            const formData = new FormData();
            fileList.forEach(file => formData.append('images', file));

            fetch('/images/upload', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                data.files.forEach((serverPath, index) => {
                    const file = fileList[index];
                    this.images.push({
                        url: URL.createObjectURL(file),
                        file: file,
                        serverPath: serverPath,
                        originalUrl: serverPath,
                        editedUrl: null,
                        inReset: false
                    });
                });
            })
            .catch(err => console.error('Upload failed:', err));
        },

        openEditModal(index) {
            const img = this.images[index];
            let modalUrl = img.editedUrl ? img.editedUrl : img.originalUrl;
            this.editingImage = { url: modalUrl, index: index };
            this.pendingReset = false;
            this.showModal = true;
            this.$nextTick(() => {
                this.initCropper();
            });
        },

        initCropper() {
            if (this.cropper) {
                this.cropper.destroy();
            }
            const image = document.getElementById('imageToEdit');
            const img = this.images[this.editingImage.index];
            let cropperUrl = this.pendingReset ? img.originalUrl : (img.editedUrl ? img.editedUrl : img.originalUrl);
            image.src = cropperUrl;
            this.cropper = new Cropper(image, {
                aspectRatio: this.aspectRatio === 'free' ? NaN : this.aspectRatio,
                viewMode: 1,
                autoCropArea: 0.8,
                responsive: true,
                background: false,
            });
        },

        setAspectRatio(ratio) {
            this.aspectRatio = ratio;
            this.cropper.setAspectRatio(ratio === 'free' ? NaN : ratio);
        },

        flip(direction) {
            if (direction === 'horizontal') {
                this.flipX *= -1;
                this.cropper.scaleX(this.flipX);
            } else {
                this.flipY *= -1;
                this.cropper.scaleY(this.flipY);
            }
        },

        removeBackground() {
            const img = this.images[this.editingImage.index];
            this.isLoading = true;
            const formData = new FormData();
            formData.append('originalUrl', img.originalUrl);
            const idx = this.editingImage.index;
            // Use the edited image from server if exists, else the original file
            if (img.editedUrl && !this.pendingReset) {
                fetch(img.editedUrl)
                    .then(res => res.blob())
                    .then(blob => {
                        formData.append('image', blob, 'edited.png');
                        return fetch('/images/remove-bg', {
                            method: 'POST',
                            body: formData
                        });
                    })
                    .then(res => res.json())
                    .then(data => {
                        const newUrl = data.newImageUrl; // Cloudinary URL
                        const cacheBustedUrl = newUrl + '?t=' + Date.now();
                        img.editedUrl = newUrl;
                        img.url = cacheBustedUrl;
                        this.images[idx].url = cacheBustedUrl;
                        this.images[idx].editedUrl = newUrl;
                        this.cropper.replace(cacheBustedUrl);
                    })
                    .catch(err => console.error('Background removal failed:', err))
                    .finally(() => this.isLoading = false);
            } else {
                formData.append('image', img.file);
                fetch('/images/remove-bg', {
                    method: 'POST',
                    body: formData
                })
                .then(res => res.json())
                .then(data => {
                    const newUrl = data.newImageUrl; // Cloudinary URL
                    const cacheBustedUrl = newUrl + '?t=' + Date.now();
                    img.editedUrl = newUrl;
                    img.url = cacheBustedUrl;
                    this.images[idx].url = cacheBustedUrl;
                    this.images[idx].editedUrl = newUrl;
                    this.cropper.replace(cacheBustedUrl);
                })
                .catch(err => console.error('Background removal failed:', err))
                .finally(() => this.isLoading = false);
            }
        },

        applyChanges() {
            const canvas = this.cropper.getCroppedCanvas();
            if (!canvas) {
                this.showModal = false;
                return;
            }
            const img = this.images[this.editingImage.index];
            const idx = this.editingImage.index;
            if (this.pendingReset) {
                // If in reset state, delete edited image from server
                fetch('/images/delete-edit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ editedUrl: img.editedUrl })
                })
                .then(() => {
                    img.editedUrl = null;
                    img.url = img.originalUrl;
                    this.images[idx].url = img.originalUrl;
                    this.images[idx].editedUrl = null;
                    this.pendingReset = false;
                    this.showModal = false;
                })
                .catch(() => {
                    img.editedUrl = null;
                    img.url = img.originalUrl;
                    this.images[idx].url = img.originalUrl;
                    this.images[idx].editedUrl = null;
                    this.pendingReset = false;
                    this.showModal = false;
                });
                return;
            }
            // Save edited image to server
            canvas.toBlob(blob => {
                const formData = new FormData();
                formData.append('image', blob, 'edited.png');
                formData.append('originalUrl', img.originalUrl);
                fetch('/images/save-edit', {
                    method: 'POST',
                    body: formData
                })
                .then(res => res.json())
                .then(data => {
                    const newUrl = data.editedUrl;
                    const cacheBustedUrl = newUrl + '?t=' + Date.now();
                    img.editedUrl = newUrl;
                    img.url = cacheBustedUrl;
                    this.images[idx].url = cacheBustedUrl;
                    this.images[idx].editedUrl = newUrl;
                    this.pendingReset = false;
                    this.showModal = false;
                })
                .catch(err => {
                    console.error('Failed to save edited image:', err);
                    this.pendingReset = false;
                    this.showModal = false;
                });
            }, 'image/png');
        },

        deleteImage() {
            const img = this.images[this.editingImage.index];
            // Remove from DOM
            this.images.splice(this.editingImage.index, 1);
            this.showModal = false;
            // Call backend to delete both original and edited
            fetch('/images/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originalUrl: img.originalUrl,
                    editedUrl: img.editedUrl
                })
            })
            .then(res => res.json())
            .then(data => {
                if (!data.success) {
                    console.error('Delete failed:', data.error);
                }
            })
            .catch(err => console.error('Delete failed:', err));
        },
        resetImage() {
            this.pendingReset = true;
            const img = this.images[this.editingImage.index];
            this.cropper.replace(img.originalUrl);
        },
        viewEdited() {
            this.pendingReset = false;
            const img = this.images[this.editingImage.index];
            if (img.editedUrl) {
                const cacheBustedUrl = img.editedUrl + '?t=' + Date.now();
                img.url = cacheBustedUrl;
                this.cropper.replace(cacheBustedUrl);
            } else {
                img.url = img.originalUrl;
                this.cropper.replace(img.originalUrl);
            }
        },
        cancelModal() {
            // Restore modal and preview to last committed state
            this.pendingReset = false;
            const img = this.images[this.editingImage.index];
            if (img.editedUrl) {
                const cacheBustedUrl = img.editedUrl + '?t=' + Date.now();
                img.url = cacheBustedUrl;
            } else {
                img.url = img.originalUrl;
            }
            this.showModal = false;
        },
    };
}
