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
		Session.setPersistent('readlist', []);
	}

	/*
	Session.setPersistent('readlist', [ {
		_id: 0,
		text: 'imma test article, so interesting, so factual, very wow.'
	}]);
	*/

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
			Feeds.update( {
				_id: currentStory._id
			}, {
				$set: {
					yeps: (currentStory.yeps || 0) + 1
				}
			});
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
			Feeds.update( {
				_id: currentStory._id
			}, {
				$set: {
					nopes: (currentStory.nopes || 0) + 1
				}
			});
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
	})();

	//Redicle Functions
	(function () {
		var readingNow = [];
		var customOptions = {
			redicleWidth: 500,
			redicleHeight: 130
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
				}
			}
			spritzController.applyOptions(customOptions);
			$('.spritzer-container').css( {
				boxShadow: 'none',
				border: 'none',
				margin: 0,
				padding: 0
			});
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

			while (article.text == undefined && readlist.length) {
				article = readlist.shift();
			}

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
			}

			SpritzClient.spritzify(article.text, 'en_us',
				function spritzSuccess(spritzText) {
				spritzController.startSpritzing(spritzText);
			}, function spritzError(spritzText) {
				//TODO: handle this error (text not processable)
			});
			Session.set('readlist', readlist);
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
				moreComments: function(){
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

}

if (Meteor.isServer) {
	Meteor.startup(function () {
		// code to run on server at startup
		(function scrapeFeeds() {
			_(Scrape.feed('http://feeds.reuters.com/reuters/politicsNews').items).each(function (v) {
				v.source = 'Reuters';
				v.yeps = 0;
				v.nopes = 0;
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
