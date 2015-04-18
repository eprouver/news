if (Meteor.isClient) {
	Router.route('/', function () {
		this.render('welcome');
	});

	Router.route('/look', function () {
		this.render('look');
	});

	//Welcome Functions
	(function () {
		Template.welcome.events( {
			'click #start': function (e, t) {
				AntiModals.overlay('start', {
					modal: true,
					overlayClass: 'primary'
				});
			},
			'click #enter': function (e, t) {
				AntiModals.overlay('enter', {
					modal: true,
					overlayClass: 'primary'
				});
			}
		});

		Template.start.events( {
			'click .close': function (e, t) {
				AntiModals.dismissOverlay(t.firstNode);
			}
		});

		Template.enter.events( {
			'click .close': function (e, t) {
				AntiModals.dismissOverlay(t.firstNode);
			},
			'click #enter-ok': function (e, t) {
				AntiModals.dismissOverlay(t.firstNode);
				document.location.href = '/look';
			}
		});
	})();


	//Look Functions
	(function () {
		function lookYep(e, t){
			alert('yep');
		};
		
		function lookNope(e,t){
			alert('nope')
		};
		
		Template.look.events( {
			'click .yep': lookYep,
			'click .nope': lookNope
		});

		Template.look.gestures( {
			'swiperight .current.headline': lookYep,
			'swipeleft .current.headline': lookNope
		});
	})();


}

if (Meteor.isServer) {
	Meteor.startup(function () {
		// code to run on server at startup
	});
}
