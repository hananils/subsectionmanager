
(function($) {

	Symphony.Language.add({
		'Some errors were encountered while attempting to save.': false,
		'Untitled': false
	});
	
	/**
	 * This plugin adds an tabbed interface for subsection management.
	 *
	 * @author: Nils Hörrmann, post@nilshoerrmann.de
	 * @source: http://github.com/nilshoerrmann/subsectionmanager
	 */
	$(document).ready(function() {
		var field = $('div.field-subsectiontabs').hide(),
			title = $('h2:first'),
			storage = field.find('ul'),
			references = field.find('a'),
			state = $.parseJSON(localStorage.getItem('subsectiontabs-' + Symphony.Context.get('env').entry_id)),
			controls, tabs, create;
			
		// Set context
		$('body').addClass('subsectiontabs');
		
		// Create interface
		controls = $('<ul id="subsectiontabs" />').insertAfter(title);
		tabs = $('<div class="tabs" />').insertAfter(controls);
		
		// Set height
		if(state) {
			tabs.height(state.height);
		}
		
		// Remove tab names from title
		if(title.text() != Symphony.Language.get('Untitled')) {
			var fragments = title.text().split(' (');
			fragments.splice(fragments.length - 1, 1);
			title.text(fragments.join(' ('));
		}
		
		// Add controls
		storage.find('li').each(function(count) {
			var item = $(this),
				control = $('<li />').appendTo(controls),
				id = item.find('input:eq(0)').val(),
				name = item.find('input:eq(1)').val(),
				link = item.find('a').attr('href');
			
			// Set values
			control.html('<span>' + name + '</span>').attr({
				'data-id': id,
				'data-link': link
			});
						
			// Restore last tab
			if(state) {
				if(name == state.tab) {
					control.addClass('selected');
				}
			}
			
			// Or select first tab
			else if(count == 0) {
				control.addClass('selected');
			}
		});
		
		// Allow dynamic controls
		if(field.find('label').is('.allow_dynamic_tabs')) {
			create = $('<li class="new"><span>+</span></li>').appendTo(controls);
		}

	/*-----------------------------------------------------------------------*/
		
		// Load tab
		controls.delegate('li:not(.new)', 'click.subsectiontabs', function(event) {
			var target = $(event.target),
				control = $(this),
				link = control.attr('data-link'),
				subsections = $('iframe.subsectiontab'),
				current = subsections.filter('[name=' + $.trim(control.text()) + ']');
				
			// Close tab editors:
			// Set timeout to not interfer with doubleclick actions
			setTimeout(function() {
				$('body').trigger('click', [control]);		
			}, 200);

			// Don't load tab while editing
			if(target.is('input')) {
				return false;
			}
			else {
				subsections.hide();
			}
				
			// Switch tabs
			control.siblings().removeClass('selected');
			control.addClass('selected');
				
			// Tab already loaded
			if(current.size() > 0) {
				resize(current);
				current.show();
			}
			
			// Tab not loaded yet
			else {
				load(link, control.text());
			}
		});

		// Dynamic tabs
		if(field.find('label').is('.allow_dynamic_tabs')) {
			
			// Create tab
			controls.delegate('li.new', 'click.subsectiontabs', function(event) {
				var control = $(this),
					new_tab = $('<li data-id="" data-link="' + field.find('input[name="field[subsection-tabs][new]"]').val() + '"></li>').insertBefore(control).click().dblclick();
			});

			// Edit tab name
			controls.delegate('li', 'dblclick.subsectiontabs', function(event) {
				var tab = $(this).addClass('selected'),
					value = tab.text(),
					input = $('<input type="text" />');
					
				// Replace text with input
				tab.html(input.val(value));
				
				// Store name and focus
				input.attr('data-name', value).focus();
			});
			
			// Fetch keys
			controls.delegate('input', 'keyup.subsectiontabs', function(event) {
				var input = $(this);

				// Enter
				if(event.which == 13) {
					$('body').click();
				}
				
				// Escape
				if(event.which == 27) {
				
					// Restore old name
					input.val(input.attr('data-name'));
					$('body').click();
				}				
			});
			
			// Stop editing tab names
			$('body').bind('click.subsectiontabs', function(event, tab) {
				if($(event.target).parents('#subsectiontabs li').size() > 0) return false;
			
				controls.find('li:has(input)').not($(tab)).each(function() {
					var tab = $(this),
						input = tab.find('input').remove(),
						text = $.trim(input.val()),
						counter = '',
						count;
					
					// Handle empty names
					if(text == '') {
						text = Symphony.Language.get('Untitled');
					}
					
					// Get clones
					count = controls.find('li:contains(' + text + ')').map(function() {
						return ($(this).text() == text);
					}).size();
					
					if(count > 0) {
						for(i = 1; i < 100; i++) {
							count = controls.find('li:contains(' + text + ')').map(function() {
								return ($(this).text() == text + ' ' + i.toString());
							}).size();
						
							if(count == 0) {
								count = i;
								break;
							};
						}
					}
					
					// Set counter
					if(count > 0) {
						counter = ' ' + (count + 1).toString();
					}
					
					// Save tab name
					tab.html('<span>' + text + counter + '</span>');
				});
			});
		}
		
		// Save tab
		$('body.subsectiontabs form div.actions input').click(function(event, validated) {
			var first = controls.find('li:first');

			// Don't send parent form until tabs have been validated and saved
			if(validated != true) {
				event.preventDefault();
			
				// Clear storage
				storage.empty();
			
				// Don't use hide(): tabs must be displayed to appease Firefox
				tabs.find('iframe').show().css('visibility', 'hidden');

				// Save tabs
				save(first);
			}
		});
		
	/*-----------------------------------------------------------------------*/
	
		// Load tab
		var load = function(link, name) {
			var subsection = $('<iframe />', {
				'class': 'subsectiontab',
				'src': link,
				'name': $.trim(name)
			}).hide().appendTo(tabs);
			
			// Prepare subsection display
			subsection.load(function() {
				var content = subsection.contents(),
					current = subsection.attr('name'),
					selected = controls.find('li.selected').text();

				// Adjust interface
				content.find('body').addClass('tabbed subsection');
				content.find('h1, h2, #nav, #notice:not(.error):not(.success), #notice a, #footer').remove();
				content.find('div.actions').css({
					'height': 0,
					'overflow': 'hidden'
				});

				// Set height
				if(current == selected && content.find('#notice').size() == 0) {
					resize(subsection);
				}
			});
		};
		
		// Save tab
		var save = function(control) {
			var tab = tabs.find('iframe[name=' + $.trim(control.text()) + ']'),
				next = control.next('li:not(.new)'),
				button = tab.contents().find('div.actions input'),
				name = $.trim(control.text()),
				id = control.attr('data-id');
			
			// Tab loaded
			if(tab.size() > 0) {
			
				// Callback
				tab.one('load', function(event) {
					var tab = $(this),
						regexp;
					
					// Get entry id
					regexp = new RegExp(/\bid-(\d*)\b/);
					id = regexp.exec(tab.contents().find('body').attr('class'));
					if(id != null) {
						id = id[1]
					}
					
					// Store errors
					if(tab.contents().find('#header .error').size() > 0) {
						control.addClass('error');
					}
					else {
						control.removeClass('error');
					}
				
					// Store data
					store(id, name, next);
				});
				
				// Post
				button.click();		
			}
			
			// Tab not loaded
			else {
				store(id, name, next);
			}
		};
		
		// Store data
		var store = function(id, name, next) {
			var item = $('<li />').appendTo(storage);
			
			item.append('<input name="fields[subsection-tabs][relation_id][]" value="' + id + '" />');
			item.append('<input name="fields[subsection-tabs][tab][]" value="' + name + '" />');
			
			// Process next tab
			if(next.size() > 0) {
				save(next);
			}
			
			// Process parent entry
			else {
						
				// Errors
				if(controls.find('li.error').size() > 0) {
					Symphony.Message.post(Symphony.Language.get('Some errors were encountered while attempting to save.'), 'error');
					controls.find('li.error:first').click();
				}
				
				else {
					$('body.subsectiontabs form div.actions input').trigger('click', [true]);				
				}
			}
		};
		
		var resize = function(subsection) {
			var height, storage;
			
			// Resize tab
			subsection.show();
			height = subsection.contents().find('#wrapper').height();
			subsection.height(height);
			tabs.animate({
				'height': height
			}, 'fast');
			
			// Store current tab
			if(localStorage) {
				state = {
					'tab': subsection.attr('name'),
					'height': height
				};
			
				localStorage.setItem('subsectiontabs-' + Symphony.Context.get('env').entry_id, JSON.stringify(state));
			}
		};
		
	/*-----------------------------------------------------------------------*/
	
		// Preload tab
		controls.find('li').each(function(position) {
			var control = $(this);
			load(control.attr('data-link'), control.text());
		});
		
	});
	
})(jQuery.noConflict());