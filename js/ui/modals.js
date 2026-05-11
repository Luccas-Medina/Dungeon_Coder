export class ModalManager {
    constructor(app) {
        this.app = app;
    }

    async show(title, message, primaryBtn = 'OK') {
        return new Promise(resolve => {
            document.getElementById('modalTitle').textContent = title;
            document.getElementById('modalMessage').textContent = message;
            document.getElementById('modalBtnPrimary').textContent = primaryBtn;
            document.getElementById('modalBtnSecondary').style.display = 'none';
            document.getElementById('modalStars').classList.add('hidden');
            document.getElementById('recordBadge').classList.add('hidden');
            document.getElementById('modalOverlay').hidden = false;

            this.app._modalAction = () => {
                resolve();
                this.hide();
            };
            this.app._modalSecondaryAction = null;
        });
    }

    hide() {
        document.getElementById('modalOverlay').hidden = true;
    }
}
