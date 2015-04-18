Feeds = new Mongo.Collection('feeds');

if (Meteor.isClient) {
	Router.route('/', function () {
		this.render('welcome');
	})
	Router.route('/look', function () {
		this.render('look');
	})
	Router.route('/read', function () {
		this.render('read');
	});

	Session.set('stories', []);
	Session.set('current', 0);
	Session.set('readlist', []);

	setTimeout(function () {
		Session.set('stories', Feeds.find().fetch());
		Session.set('current', 0);
	}, 1000);


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
		function lookYep(e, t) {
			function addStory(story) {
				if (!story.text) {
					//TODO: start loading animation
					var readlist = Session.get('readlist');
					readlist.push(story);
					Session.set('readlist', readlist);
					
					var iframe = $(document.createElement('iframe'));				
					//TODO: speed up loading, try DOMcontentloaded
					$('#iframeholder').append(iframe.attr('src', story.link).on('load', function () {
						var self = this;
						Meteor.call('scrapeArticle', this.src, function (e, t) {
							//TODO: stop loading animation
							story.text = t.text;
							var readlist = Session.get('readlist');

							readlist = _(readlist).map(function(v){
								if(v._id == story._id){
									return story;
									//TODO: I found it, can I break out of this each?
								}
								return v;
							});
							Session.set('readlist', readlist);
							$(self).remove();
						});
					}));
				}else {
					var readlist = Session.get('readlist');
					readlist.push(story);
					Session.set('readlist', readlist);
				}
			}

			addStory(Session.get('stories')[Session.get('current')]);
			Session.set('current', Session.get('current') + 1);
			//Headline Exit Animation
			$('.headline-holder').append($('.current.headline').clone().removeClass('current').addClass('leaving animated fadeOutRight').one('animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd', function () {
				$(this).remove();
			}));

		};

		function lookNope(e, t) {
			Session.set('current', Session.get('current') + 1);
			//Headline Exit Animation
			$('.headline-holder').append($('.current.headline').clone().removeClass('current').addClass('leaving animated fadeOutLeft').one('animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd', function () {
				$(this).remove();
			}));
		};

		Template.look.events( {
			'click .yep': lookYep,
			'click .nope': lookNope,
			'click #readnow': function(){
				document.location.href = '/read';
			}
		});

		Template.look.gestures( {
			'swiperight .current.headline': lookYep,
			'swipeleft .current.headline': lookNope
		});

		Template.look.helpers( {
			currentStory: function () {
				return Session.get('stories')[Session.get('current')];
			},
			readlist: function () {
				return Session.get('readlist');
			}
		})
	})();


}

if (Meteor.isServer) {
	Meteor.startup(function () {
		// code to run on server at startup

	(function scrapeFeeds() {
		_(Scrape.feed('http://feeds.reuters.com/reuters/politicsNews').items).each(function (v) {
			v.source = 'Reuters'
			Feeds.insert(v);
		});
	})();

	});

	Meteor.methods( {
		scrapeArticle: function (url) {
			//TODO: Check if text already exists
			return Scrape.website(url);
		}
	});
}
