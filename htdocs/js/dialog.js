// Dialogs

app.dialog = {
	
	active: false,
	hideTimer: null,
	
	show: function(ref, placement, html) {
		// show popup dialog with arrow pointing to ref element
		if (this.active) this.hide(true);
		
		$('#popper_dialog').html(html);
		$('#popper_dialog_container').addClass('active');
		$('#popper_dialog_overlay').addClass('active');
		
		// only dim the chat area if the ref element isn't inside it
		if (!$.contains($('.scrollarea')[0], $(ref)[0])) {
			$('.scrollarea').addClass('disabled');
		}
		
		this.popper = new Popper(
			$(ref)[0],
			$('#popper_dialog_container')[0],
			{
				placement: placement
			}
		);
		
		this.active = true;
	},
	
	hide: function() {
		// hide dialog if active
		if (this.active) {
			// one-time hooks
			if (this.onBeforeHide) {
				this.onBeforeHide();
				delete this.onBeforeHide;
			}
			
			this.popper.destroy();
			
			$('#popper_dialog').html('');
			$('#popper_dialog_container').removeClass('active');
			$('#popper_dialog_overlay').removeClass('active');
			$('.scrollarea').removeClass('disabled');
			
			this.active = false;
			
			// one-time hooks
			if (this.onHide) {
				this.onHide();
				delete this.onHide;
			}
			delete this.onKeyDown;
		}
	}
	
};
