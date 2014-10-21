'use strict';

/*
 * DCC Beverage Service Calculator
 * October, 2014
 * eran@sofcorp.com
 *
 * This calculator takes a variety of inputs from the user and determines a
 * configuration of beverage containers for them to rent. This logic is tightly
 * couple with and entirely dependent on both WooCommerce and WordPress. So 
 * tightly, in fact, that it requires a product exist in WooCommerce with the 
 * ID of */ var productId = 1398; /* so if someone changes the product up, that
 * might be why. 
 * 
 * The backend PHP and this JS logic both support a debug mode which can be 
 * enabled by appending `?debug=1` to the URL during testing. This will only
 * display the calculated results rather than add them to the card and redirect
 * the user. 
 */

jQuery(function($){

	/*
	 * Handle form submit (a.k.a. "The Magic")
	 */
	$('.beverage-calculator form').submit(function(event){

		event.preventDefault();
		var $form = $(this);

		/*
		 * This object stores the various percentages the group is predicted to 
		 * consume given the time of day and gender balance.
		 */
		var consumptionRatios = {
			regularCoffee: {
				morn: {
					0: 0.6, // All men
					50: 0.5, // Mixed
					100: 0.5, // All women
				},
				eve: {
					0: 0.35, // All men
					50: 0.35, // Mixed
					100: 0.3, // All women
				}
			},
			decafCoffee: {
				morn: {
					0: 0.2, // All men
					50: 0.25, // Mixed
					100: 0.25, // All women
				},
				eve: {
					0: 0.25, // All men
					50: 0.2, // Mixed
					100: 0.2, // All women
				}
			},
			hotTea: {
				morn: {
					0: 0.1, // All men
					50: 0.1, // Mixed
					100: 0.15, // All women
				},
				eve: {
					0: 0.1, // All men
					50: 0.1, // Mixed
					100: 0.15, // All women
				}
			},
			icedTea: {
				morn: {
					0: 0.2, // All men
					50: 0.2, // Mixed
					100: 0.25, // All women
				},
				eve: {
					0: 0.2, // All men
					50: 0.2, // Mixed
					100: 0.25, // All women
				}
			}
		}

		/*
		 * This object maps the form fields that will be used to submit order
		 * data to WooCommerce
		 */
		var formFields = {
			quantity: 1,
			'product_id': productId,
			regularCoffee: {
				pp:     'addon-' + productId + '-regular-coffee[2-1-liter-pump-pot]',
				gal320: 'addon-' + productId + '-regular-coffee[2-5-gallon-cambro]',
				gal640: 'addon-' + productId + '-regular-coffee[5-gallon-cambro]'
			},
			decafCoffee: {
				pp:     'addon-' + productId + '-decaf-coffee[2-1-liter-pump-pot]',
				gal320: 'addon-' + productId + '-decaf-coffee[2-5-gallon-cambro]',
				gal640: 'addon-' + productId + '-decaf-coffee[5-gallon-cambro]'
			},
			hotTea: {
				pp:     'addon-' + productId + '-hot-tea[2-1-liter-pump-pot]',
				gal320: 'addon-' + productId + '-hot-tea[2-5-gallon-cambro]',
				gal640: 'addon-' + productId + '-hot-tea[5-gallon-cambro]'
			},
			icedTea: {
				pp:     'addon-' + productId + '-iced-tea[2-1-liter-pump-pot]',
				gal320: 'addon-' + productId + '-iced-tea[2-5-gallon-cambro]',
				gal640: 'addon-' + productId + '-iced-tea[5-gallon-cambro]'
			},
			hotWater: 'addon-' + productId + '-hot-water[gallons]',
			notes:    'addon-' + productId + '-details[order-notes]'
		};

		/*
		 * Extract the values from the table for easy access later.
		 */
		var values = {};
		$.each($form.serializeArray(), function(i, field) {
			values[field.name] = field.value;
		});

		/*
		 * For each beverage selected in the form, calculate the number of 
		 * individuals that will be consuming it.
		 */
		var order = {};
		for(var beverage in consumptionRatios){
			if(values.hasOwnProperty(beverage)){

				// The structure of the beverage order:
				order[beverage] = {
					oz: 0, // Number of ounces required
					containers: {
						// pp: 0,     // 2.5 Liter (88 oz.) Pump Pot
						// gal320: 0, // 2.5 Gallon (320 oz.) Cambro
						// gal640: 0  // 5 Gallon (640 oz.) Cambro
					},
					overage: 0 // How much more will be ordered than the ounces calculated
				};

				// This gets the ratio from the consumptionRatios object above
				var ratio = consumptionRatios[beverage][values.time][values.genderRatio]

				// Determine how many individuals will be drinking the given beverage
				var numberOfDrinkers = Math.ceil(values.guests * ratio);

				// Compute the total ounces required of the beverage
				order[beverage].oz = Math.ceil(numberOfDrinkers * values.cupSize);

				if(order[beverage].oz <= 88){
					order[beverage].containers.pp = 1;
					order[beverage].overage = 88 - order[beverage].oz;
				}else if (order[beverage].oz <= 320){
					order[beverage].containers.gal320 = 1;
					order[beverage].overage = 320 - order[beverage].oz;
				}else{
					order[beverage].containers.gal640 = gallonReducer(order[beverage].oz);
					order[beverage].overage = 640 * order[beverage].containers.gal640 - order[beverage].oz;
				}

			}
		}

		/*
		 * Build WooCommerce-ready order object
		 */
		var orderObject = {
			'add-to-cart': formFields['product_id'],
			quantity:      formFields['quantity']
		}
		for(var beverage in order){
			for(var size in order[beverage].containers){
				orderObject[formFields[beverage][size]] = order[beverage]['containers'][size];
			}
		}
		orderObject[formFields['hotWater']] = values.water;
		orderObject[formFields['notes']] = values.notes;

		/*
		 * This is the final coup de grâce, use AJAX to post the product details
		 * to WP which will pass the product to the cart. On success, redirect
		 * the user to the cart. 
		 */
		if(!window.bevCalcDebug){
			$.post('/wp-admin/admin-ajax.php', orderObject)
				.done(function(data){
					location.href = '/cart/';
				});
		}else{
			/*
			 * If debug global is true then just display the order that _would_ be placed
			 */
			var output = '';
			for(var beverage in order){
				output += '<strong>' + beverage + '</strong>';
				output += '<dl>';
				output += '<dt>Ounces Computed</dt>';
				output += '<dd>' + order[beverage].oz + '</dd>';
				if(order[beverage].containers.pp){
					output += '<dt>2.5 Liter (88 oz.) Pump Pot</dt>';
					output += '<dd>' + order[beverage].containers.pp + '</dd>';
				}else if(order[beverage].containers.gal320){
					output += '<dt>2.5 Gallon (320 oz.) Cambro</dt>';
					output += '<dd>' + order[beverage].containers.gal320 + '</dd>';
				}else{
					output += '<dt>5 Gallon (640 oz.) Cambro</dt>';
					output += '<dd>' + order[beverage].containers.gal640 + '</dd>';
				}
				output += '<dt>Overage</dt>';
				output += '<dd>' + order[beverage].overage + '</dd>';
				output += '</dl><hr>';
			}
			$('.debug-output').html(output /*+ '<pre />'*/);
			// $('.debug-output pre').text(
			// 	JSON.stringify(orderObject, null, 2) + '\n\n' +
			// 	$.param(orderObject)
			// );
		}

		return false;
	});

		function gallonReducer(amount){
			if(amount <= 640){
				return 1;
			}else{
				return 1 + gallonReducer(amount - 640);
			}
		}

});