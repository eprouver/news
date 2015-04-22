Feeds = new Mongo.Collection('feeds');
Comments = new Mongo.Collection('comments');
var yepnope_dep = new Deps.Dependency();

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
	Router.route('/spritz_login', function () {
		this.render('spritz_login');
	});
	Router.route('/review', function () {
		this.render('review');
	});
	Router.route('/me', function () {
		this.render('me');
	});

	var spritzController;
	Session.set('stories', []);
	Session.set('current', 0);
	if (!Session.get('readlist')) {
		Session.setPersistent('readlist', new Array());
	}

	/*
	Session.setPersistent('readlist', [ {
		_id: 0,
		text: 'imma test article, so interesting, so factual, very wow.'
	}]);
	*/

	(function checkforstories() {
		var stories = Feeds.find().fetch();
		if (stories.length > 0) {
			Session.set('stories', stories);
			Session.set('current', 0);
		}else {
			setTimeout(checkforstories, 500);
		}
	})();

	//Welcome Functions
	(function () {
		trimInput = function (value) {
			return value.replace(/^\s*|\s*$/g, '');
		};

		isNotEmpty = function (value) {
			if (value && value !== '') {
				return true;
			}
			console.log('Please fill in all required fields.');
			return false;
		};

		isEmail = function (value) {
			var filter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
			if (filter.test(value)) {
				return true;
			}
			console.log('Please enter a valid email address.');
			return false;
		};

		isValidPassword = function (password) {
			if (password.length < 6) {
				console.log('Your password should be 6 characters or longer.');
				return false;
			}
			return true;
		};

		areValidPasswords = function (password, confirm) {
			if (!isValidPassword(password)) {
				return false;
			}
			if (password !== confirm) {
				console.log('Your two passwords are not equivalent.');
				return false;
			}
			return true;
		};

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

		var currentStep = 0;
		Template.start.events( {
			'click .close': function (e, t) {
				AntiModals.dismissOverlay(t.firstNode);
			},
			'click .next-step': function (e, t) {
				currentStep += 1;
				signin_dep.changed();
				$('.progress .inner').css( {
					width: 100 * (currentStep / 3) + '%'
				})
			},
			'click .new-user': function () {
				//TODO: verify all user input and kick them back
				document.location.href = '/me?first=true';
			}
		});

		var signin_dep = new Deps.Dependency();

		Template.start.helpers( {
			isEmail: function () {
				signin_dep.depend();
				return currentStep == 0;
			},
			isPersonal: function () {
				signin_dep.depend();
				return currentStep == 1;
			},
			isEconomic: function () {
				signin_dep.depend();
				return currentStep == 2;
			},
			isPassword: function () {
				signin_dep.depend();
				return currentStep == 3;
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

	//YepNope Functions
	(function () {
		Template.yepnope.helpers( {
			yeps: function () {
				yepnope_dep.depend();
				return Template.instance().data.yeps();
			},
			nopes: function () {
				yepnope_dep.depend();
				return Template.instance().data.nopes();
			}
		});

	})();

	function sendToIframe(story) {
		if (story == undefined) return ;

		var iframe = $(document.createElement('iframe'));
		//TODO: speed up loading, try DOMcontentloaded
		$('#iframeholder').append(iframe.attr('src', story.link).on('load', function () {
			var self = this;
			Meteor.call('scrapeArticle', this.src, function (e, t) {
				//TODO: stop loading animation
				story.text = t.text;
				var readlist = Session.get('readlist');

				readlist = _(readlist).map(function (v) {
					if (v._id == story._id) {
						return story;
					}
					return v;
				});
				Session.setPersistent('readlist', readlist);
				$('.container').trigger('wordsAdded');
				$(self).remove();
			});
		}));
	}

	//Look Functions
	(function () {
		var maxWords = 100;
		var currentStory = Session.get('stories')[Session.get('current')];

		Template.look.data = function () {
			return {
				yeps: function () {
					if (!currentStory) {
						return 0;
					}else {
						return (currentStory.yeps || 0)
					}
				},
				nopes: function () {
					if (!currentStory) {
						return 0;
					}else {
						return (currentStory.nopes || 0)
					}
				}
			};
		}
		function lookYep(e, t) {
			function addStory(story) {
				if (!story.text) {
					//TODO: start loading animation
					var readlist = Session.get('readlist');
					readlist.push(story);
					Session.setPersistent('readlist', readlist);

					sendToIframe(story);
				}else {
					var readlist = Session.get('readlist');
					readlist.push(story);
					Session.setPersistent('readlist', readlist);
					$('.container').trigger('wordsAdded');
				}
			}

			addStory(currentStory);
			//Headline Exit Animation
			$('.headline-holder').append($('.current.headline').clone().removeClass('current').addClass('leaving animated fadeOutRight').one('animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd', function () {
				$(this).remove();
			}));

			//Record Vote
			if (currentStory) {
				Feeds.update( {
					_id: currentStory._id
				}, {
					$set: {
						yeps: (currentStory.yeps || 0) + 1
					}
				});
			}

			Session.set('current', Session.get('current') + 1);
			currentStory = Session.get('stories')[Session.get('current')];
			yepnope_dep.changed();
		};

		function lookNope(e, t) {
			//Headline Exit Animation
			$('.headline-holder').append($('.current.headline').clone().removeClass('current').addClass('leaving animated fadeOutLeft').one('animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd', function () {
				$(this).remove();
			}));

			//Record Vote
			if (currentStory) {
				Feeds.update( {
					_id: currentStory._id
				}, {
					$set: {
						nopes: (currentStory.nopes || 0) + 1
					}
				});
			}

			Session.set('current', Session.get('current') + 1);
			currentStory = Session.get('stories')[Session.get('current')];
			yepnope_dep.changed();
		};

		function totalWords() {
			return _.chain(Session.get('readlist'))
				.pluck('text')
				.filter(function (v) {
				return v;
			})
				.reduce(function (c, p) {
				return c + p.length
			}, 0)
				.value() || 0;
		};

		Template.look.events( {
			'click .yep': lookYep,
			'click .nope': lookNope,
			'click #readnow': function () {
				document.location.href = '/read';
			},
			'wordsAdded ': function (e, t) {
				$(t.find('.progress .inner')).css( {
					width: ((totalWords() / maxWords) * 100) + '%'
				});
			}
		});

		Template.look.gestures( {
			'swiperight .current.headline': lookYep,
			'swipeleft .current.headline': lookNope
		});

		Template.look.helpers( {
			currentStory: function () {
				currentStory = Session.get('stories')[Session.get('current')];
				yepnope_dep.changed();
				return currentStory;
			},
			readlist: function () {
				return Session.get('readlist');
			},
			enough: function () {
				return (totalWords() / maxWords) >= 1;
			}
		});

		Template.look.onCreated(function () {
			Session.set('readState', 'start');
			//TODO: reloading iframe, find a way to persist between views
			_.chain(Session.get('readlist')).filter(function (v) {
				return v.text == undefined
			}).each(sendToIframe);
		});

	})();

	//Redicle Functions
	(function () {
		var readingNow = [];
		var customOptions = {
			redicleWidth: 500,
			redicleHeight: 130,
			speedItems: [250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850]
		};

		function resizer() {
			customOptions = {
				redicleWidth: $('#spritz-holder').width(),
				redicleHeight: 130,
				placeholderText: {
					startText: "Text Appears Here",
					startTextColor: "#bababa",
					endText: "",
					endTextColor: "#bababa"
				},
				speedItems: [250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850]
			}
			spritzController.applyOptions(customOptions);
			$('.spritzer-container').css( {
				boxShadow: 'none',
				border: 'none',
				margin: 0,
				padding: 0
			});
			$('.spritzer-dropdown-menu').css( {
				position: 'fixed',
				top: '1rem',
				right: '1rem'
			})
		};

		function showProgress(now, all) {
			$('.progress .inner').css( {
				width: Math.round((now / all) * 100) + '%'
			});
		};
		$(document).ready(function () {
			spritzController = new SPRITZ.spritzinc.SpritzerController(customOptions);
			spritzController.attach($("#spritzer"));
			spritzController.setProgressReporter(showProgress);
		});

		Template.redicle.onRendered(function () {
			$('#spritz-holder').append($('#spritzer'));
			$(window).on('resize', resizer);
			resizer();
			$('.container').trigger('spritzReady');
		});

		Template.redicle.onDestroyed(function () {
			$('#spritz-home').append($('#spritzer'));
			$(window).off('resize', resizer);
		});
	})();

	//Read Functions
	(function () {
		var article = {
			text: undefined
		};

		function nextArticle() {
			var readlist = Session.get('readlist');
			article = {
				text: undefined
			};

			for (var i = 0; i < readlist.length; i++) {
				if (readlist[i].text) {
					article = readlist.splice(i, 1)[0];
				}
			}

			//TODO: Add article to history

			//TODO: paginate comments
			Session.set('discussion', {
				comments: Comments.find( {
					articleId: article._id
				}).fetch(),
				current: 0
			});
			yepnope_dep.changed();

			if (!article.text) {
				//TODO: handle this error (no article found)
				Session.set('readState', 'done');
			}

			SpritzClient.spritzify(article.text, 'en_us',
				function spritzSuccess(spritzText) {
				spritzController.startSpritzing(spritzText);
			}, function spritzError(spritzText) {
				//TODO: handle this error (text not processable)
			});
			Session.setPersistent('readlist', readlist);
			//TODO: Add article to user's history
		}

		Template.read.helpers( {
			isReady: function () {
				return (Session.get('readState') == 'ready');
			},
			isStart: function () {
				return (Session.get('readState') == 'start');
			},
			isDone: function () {
				return (Session.get('readState') == 'done');
			},
			comments: function () {
				return Session.get('discussion').comments;
			},
			yeps: function () {
				var currentComment = Session.get('discussion').comments[Session.get('discussion').current];
				return currentComment.yeps;
			},
			nopes: function () {
				var currentComment = Session.get('discussion').comments[Session.get('discussion').current];
				return currentComment.nopes;
			}
		});

		Template.read.events( {
			'spritzReady .container': function (e, t) {

			},
			'onSpritzComplete .container': function (e, t) {
				$('.progress .inner').hide().css( {
					width:'0'
				});
				_.delay(function () {
					$('.progress .inner').show();
				}, 0);
				if (Session.get('readlist').length) {
					Session.set('readState', 'ready');
				}else {
					Session.set('readState', 'done');
				}

			},
			'playSpritz .play-spritz': function (e, t) {
				nextArticle();
				Session.set('readState', 'reading');
			},
			'click #show-comments': function (e, t) {
				AntiModals.overlay('talk', {
					modal: true,
					overlayClass: 'primary'
				});
			},
			'click #done-reading': function (e, t) {
				document.location.href = '/review';
			}
		});

		Template.read.onCreated(function () {
			Session.set('readState', 'start');
			//TODO: reloading iframe, find a way to persist between views
			_.chain(Session.get('readlist')).filter(function (v) {
				return v.text == undefined
			}).each(sendToIframe);
		});

		/* Comments */
		(function () {
			var currentComment;
			Template.talk.data = function () {
				return {
					yeps: function () {
						if (!currentComment) {
							currentComment = Session.get('discussion').comments[Session.get('discussion').current];
						}
						if (!currentComment) {
							return 0;
						}else {
							return (currentComment.yeps || 0)
						}
					},
					nopes: function () {
						if (!currentComment) {
							currentComment = Session.get('discussion').comments[Session.get('discussion').current];
						}
						if (!currentComment) {
							return 0;
						}else {
							return (currentComment.nopes || 0)
						}
					}
				};
			}

			function commentYep() {
				$('.comment-holder').append($('.current.comment').clone().removeClass('current').addClass('leaving animated fadeOutRight').one('animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd', function () {
					$(this).remove();
				}));

				//TODO: record votes
				var discussion = Session.get('discussion');
				discussion.current += 1;
				Session.set('discussion', discussion);
				Comments.update( {
					_id: currentComment._id
				}, {
					$set: {
						yeps: currentComment.yeps + 1
					}
				});
				currentComment = discussion.comments[discussion.current];
				yepnope_dep.changed();
			}

			function commentNope() {
				$('.comment-holder').append($('.current.comment').clone().removeClass('current').addClass('leaving animated fadeOutLeft').one('animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd', function () {
					$(this).remove();
				}));

				//TODO: record votes
				var discussion = Session.get('discussion');
				discussion.current += 1;
				Session.set('discussion', discussion);

				Comments.update( {
					_id: currentComment._id
				}, {
					$set: {
						nopes: currentComment.nopes + 1
					}
				});
				currentComment = discussion.comments[discussion.current];
				yepnope_dep.changed();
			}

			Template.talk.gestures( {
				'swiperight .current.comment': commentYep,
				'swipeleft .current.comment': commentNope
			});

			Template.talk.events( {
				'click .yep': commentYep,
				'click .nope': commentNope,
				'click .close': function (e, t) {
					AntiModals.dismissOverlay(t.firstNode);
				},
				'click #add-comment': function (e, t) {
					Comments.insert( {
						articleId: article._id,
						text: t.find('textarea').value,
						author: 'guest',
						yeps: 0,
						nopes: 0
					});
					AntiModals.dismissOverlay(t.firstNode);
					nextArticle();
				}
			});

			Template.talk.helpers( {
				prevComments: function () {
					var length = Session.get('discussion').comments.length;
					var current = Session.get('discussion').current;
					return length > 0;
				},
				moreComments: function () {
					var length = Session.get('discussion').comments.length;
					var current = Session.get('discussion').current;
					return length > current;
				},
				currentComment: function () {
					currentComment = Session.get('discussion').comments[Session.get('discussion').current];
					return currentComment;
				},
				comments: function () {
					return Session.get('discussion').comments;
				}
			});
		})();
	})();

	/* Review Functions*/
	(function () {
		Template.review.events( {
			'click #link-headlines': function () {
				document.location.href = '/look';
			},
			'click #link-profile': function () {
				document.location.href = '/me';
			}
		});
	})();

	(function () {
		Template.me.events( {
			'click #to-headlines': function (e, t) {
				document.location.href = '/look';
			}
		});
	})();

}

if (Meteor.isServer) {
	Meteor.startup(function () {
		// code to run on server at startup
		/*
		(function scrapeFeeds() {
			_(Scrape.feed('http://feeds.reuters.com/reuters/politicsNews').items).each(function (v) {
				v.source = 'Reuters';
				v.yeps = 0;
				v.nopes = 0;
				Feeds.insert(v);
			});
		})();
		*/

	});

	Meteor.methods( {
		scrapeArticle: function (url) {
			//TODO: Check if text already exists
			return Scrape.website(url);
		}
	});
}
