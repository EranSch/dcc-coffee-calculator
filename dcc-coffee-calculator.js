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

(function($){

	function CoffeeCalculator(){

		this.values = {};
		this.order = {};

		/*
		 * This object stores the various percentages the group is predicted to 
		 * consume given the time of day and gender balance.
		 */
		this.consumptionRatios = {
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
		this.formFields = {
			quantity: 1,
			'product_id': productId,
			regularCoffee: {
				pretty: 'Regular Coffee',
				pp:     'addon-' + productId + '-regular-coffee[2-5-liter-pump-pot]',
				gal320: 'addon-' + productId + '-regular-coffee[2-5-gallon-cambro]',
				gal640: 'addon-' + productId + '-regular-coffee[5-gallon-cambro]',
				gallon: 'addon-' + productId + '-regular-coffee[gallons-if-using-cambros]'
			},
			decafCoffee: {
				pretty: 'Decaf Coffee',
				pp:     'addon-' + productId + '-decaf-coffee[2-5-liter-pump-pot]',
				gal320: 'addon-' + productId + '-decaf-coffee[2-5-gallon-cambro]',
				gal640: 'addon-' + productId + '-decaf-coffee[5-gallon-cambro]',
				gallon: 'addon-' + productId + '-decaf-coffee[gallons-if-using-cambros]'
			},
			hotTea: {
				pretty: 'Hot Tea',
				pp:     'addon-' + productId + '-hot-tea[2-5-liter-pump-pot]',
				gal320: 'addon-' + productId + '-hot-tea[2-5-gallon-cambro]',
				gal640: 'addon-' + productId + '-hot-tea[5-gallon-cambro]',
				gallon: 'addon-' + productId + '-hot-tea[gallons-if-using-cambros]'
			},
			icedTea: {
				pretty: 'Iced Tea',
				pp:     'addon-' + productId + '-iced-tea[2-5-liter-pump-pot]',
				gal320: 'addon-' + productId + '-iced-tea[2-5-gallon-cambro]',
				gal640: 'addon-' + productId + '-iced-tea[5-gallon-cambro]',
				gallon: 'addon-' + productId + '-iced-tea[gallons-if-using-cambros]'
			},
			hotWater: 'addon-' + productId + '-hot-water[gallons]',
			notes:    'addon-' + productId + '-details[order-notes]'
		};

		// Convert Oz to Gal and round to next .5 increment
		this._convertOunceToGal = function(oz){
			var gal = oz * 0.0078125;
			return 0.5 * Math.ceil(gal/0.5)
		}

	}

	CoffeeCalculator.prototype.calc = function(form){
		var self = this;
		var $form = $(form);

		self.values = {};
		self.order = {};
		var totalOz = 0;

		/*
		 * Extract the values from the table for easy access later.
		 */
		var addons = [];
		$.each($form.serializeArray(), function(i, field) {
			if(field.name == 'addons[]'){
				addons.push(field.value);
			}else{
				self.values[field.name] = field.value;
			}
		});
		self.values.addons = addons.join(', ');

		/*
		 * For each beverage selected in the form, calculate the number of 
		 * individuals that will be consuming it.
		 */
		for(var beverage in self.consumptionRatios){
			if(self.values.hasOwnProperty(beverage)){

				// The structure of the beverage order:
				self.order[beverage] = {
					oz: 0, // Number of ounces required
					containers: {
						// pp: 0,     // 2.5 Liter (88 oz.) Pump Pot
						// gal320: 0, // 2.5 Gallon (320 oz.) Cambro
						// gal640: 0  // 5 Gallon (640 oz.) Cambro
					},
					overage: 0 // How much more will be ordered than the ounces calculated
				};

				// This gets the ratio from the consumptionRatios object above
				var ratio = self.consumptionRatios[beverage][self.values.time][self.values.genderRatio]

				// Determine how many individuals will be drinking the given beverage
				var numberOfDrinkers = Math.ceil(self.values.guests * ratio);

				// Compute the total ounces required of the beverage
				self.order[beverage].oz = Math.ceil(numberOfDrinkers * self.values.cupSize);

				if(self.order[beverage].oz <= 88){
					self.order[beverage].containers.pp = 1;
					self.order[beverage].overage = 88 * self.order[beverage].containers.pp - self.order[beverage].oz;
				// }else if(self.order[beverage].oz <= 176){
				// 	self.order[beverage].containers.pp = 2;
				// 	self.order[beverage].overage = 88 * self.order[beverage].containers.pp - self.order[beverage].oz;
				// }else if(self.order[beverage].oz <= 264){
				// 	self.order[beverage].containers.pp = 3;
				// 	self.order[beverage].overage = 88 * self.order[beverage].containers.pp - self.order[beverage].oz;
				}else if (self.order[beverage].oz <= 320){
					self.order[beverage].containers.gal320 = 1;
					self.order[beverage].overage = 320 * self.order[beverage].containers.gal320 - self.order[beverage].oz;
				}else{
					self.order[beverage].containers.gal640 = Math.ceil(self.order[beverage].oz / 640);
					self.order[beverage].overage = 640 * self.order[beverage].containers.gal640 - self.order[beverage].oz;
				}
			}
		}
	}


	CoffeeCalculator.prototype.getWooOrder = function(){

		var self = this;
		if($.isEmptyObject(self.order))
			return null;

		var orderObject = {
			'add-to-cart': self.formFields['product_id'],
			quantity:      self.formFields['quantity']
		}
		for(var beverage in self.order){
			for(var size in self.order[beverage].containers){
				orderObject[self.formFields[beverage][size]] = self.order[beverage]['containers'][size];
				if(self.order[beverage]['containers'][size] && self.order[beverage]['containers'][size] != 'pp'){
					// If the container size is something either than Pump Pots, also store the volume required
					orderObject[self.formFields[beverage]['gallon']] = self._convertOunceToGal(self.order[beverage].oz);
				}
			}
		}
		orderObject[self.formFields['hotWater']] = self.values.water;

		if(self.values.addons.length > 0){
			var str = 'Addons Requested: ' + self.values.addons;
			orderObject[self.formFields['notes']] = str + '\n\n';
		}

		orderObject[self.formFields['notes']] += self.values.notes;

		return orderObject;
	}


	CoffeeCalculator.prototype.showOrder = function(){

		var self = this;
		var output = '';
		var totalCost = 0;
		var totalVol = 0;

		for(var beverage in self.order){
			output += '<strong>' + self.formFields[beverage].pretty + '</strong>';
			if(!self.order[beverage].containers.pp){
				var gallons = self._convertOunceToGal(self.order[beverage].oz);
				totalVol += gallons;
				output += '<p>Recommended Amount: ' + gallons + ' gal</p>';
			}
			output += '<dl>';
			var gallons = self._convertOunceToGal(self.order[beverage].oz);
			if(self.order[beverage].containers.pp){
				var count = self.order[beverage].containers.pp;
				var cost  = window.containerPricing[beverage].pp * count;
				totalCost += cost;
				output += '<dt>' + '(' + count + ') ' + '2.5 Liter (88 oz.) Pump Pot</dt>';
				output += '<dd>$' + cost.toFixed(2) + '</dd>';
			}else if(self.order[beverage].containers.gal320){
				var count = self.order[beverage].containers.gal320;
				var cost  = window.containerPricing[beverage].gallon * gallons;
				totalCost += cost;
				output += '<dt>' + '(' + count + ') ' + '2.5 Gallon (320 oz.) Cambro</dt>';
				output += '<dd>$' + cost.toFixed(2) + '</dd>';
			}else{
				var count = self.order[beverage].containers.gal640;
				var cost  = window.containerPricing[beverage].gallon * gallons;
				totalCost += cost;
				output += '<dt>' + '(' + count + ') ' + '5 Gallon (640 oz.) Cambro</dt>';
				output += '<dd>$' + cost.toFixed(2) + '</dd>';
			}
			// output += '<dt>Overage</dt>';
			// output += '<dd>' + order[beverage].overage + '</dd>';
			output += '</dl>';
		}

		if(self.values.water){
			totalCost += 6.99;;
			output += '<strong>Hot Water</strong>';
			output += '<dl>';
			output += '<dt>(' + self.values.water + ') Gallon(s)</dt>';
			output += '<dd>$6.99</dd>';
			output += '</dl>';
		}

		totalCost += 50;
		output += '<dl>';
		output += '<dt><strong>Refundable Deposit</strong></dt>';
		output += '<dd>$50.00</dd>';
		output += '</dl>';

		output += '<dl>';
		output += '<dt><strong>Total</strong></dt>';
		output += '<dd>$' + totalCost.toFixed(2) + '</dd>';
		output += '</dl>';

		if(totalVol > 20){
			// Order exceeded maximum allowed volume
			$('.calc-output').html(output);
			$('.calc-output').addClass('alert-visible');
			$('.add-to-cart').prop('disabled', true);
			$('<div class="order-alert"/>')
				.text('This order exceeds the maximum volume we can offer at one time.')
				.appendTo($('.calc-output'));
		}else{
			$('.calc-output').removeClass('alert-visible');
			$('.add-to-cart').prop('disabled', false);
			$('.calc-output').html(output);
		}
	}


	CoffeeCalculator.prototype.submitOrder = function(){
		var self = this;
		var wooOrder = self.getWooOrder();
		if(wooOrder){
			$.post('/wp-admin/admin-ajax.php', wooOrder)
				.done(function(data){
					location.href = '/cart/';
				});
		}
	}


	$(function(){
		var coffeeCalculator = new CoffeeCalculator();;
		$('.beverage-calculator form')
			.on('change', function(event){
				coffeeCalculator.calc(this)
				coffeeCalculator.showOrder();})
			.on('submit', function(){
				$('.right-half').show();
				return false;
			});
		$('.add-to-cart').on('click', function(){
			coffeeCalculator.submitOrder.call(coffeeCalculator);
		});
	})

})(jQuery);