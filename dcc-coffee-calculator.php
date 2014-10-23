<?php
/**
* Plugin Name: DCC Coffee Calculator
* Description: Embeddable JavaScript calculator to help users assess the quantities pertaining to their beverage service. Upon calculation, the order is added directly to the user's WooCommerce cart.
* Plugin URI: http://cooksandcoffee.com
* Author: Eran Schoellhorn
* Author URI: http://eran.sh
* Version: 1.0
* License: GPL2
*/

/*
Copyright (C) 2014  Eran Schoellhorn  me@eran.sh

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License, version 2, as
published by the Free Software Foundation.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/

if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'plugins_loaded', array( 'DCC_CoffeeCalculator', 'get_instance' ) );

class DCC_CoffeeCalculator {

	private static $product_id = 1398; // WooCommerce Product ID
	private static $instance = null;

	public static function get_instance() {
		if ( ! isset( self::$instance ) )
			self::$instance = new self;
		return self::$instance;
	}

	private function __construct() {
		add_action(    'wp_enqueue_scripts'  , array( $this, 'conditionally_load_assets'  ));
		add_shortcode( 'coffee-calculator'   , array( $this, 'display_calculator'         ));
	}

	public function display_calculator( $atts ) {

		// Get pricing from WooCommerce product, format for easy input into JS on page
		$product_meta = get_post_meta(self::$product_id, '_product_addons');
		$container_pricing = array();
		foreach ($product_meta[0] as $key => $addon) {
			if(!in_array($addon['name'], 
				array('Regular Coffee', 'Decaf Coffee', 'Hot Tea', 'Iced Tea'))){
					continue;
				}
			$camelCaseName = lcfirst(str_replace(" ", "", ucwords(trim($addon['name']))));
			$container_pricing[$camelCaseName] = array(
				'pp'     => $addon['options'][0]['price'],
				'gal320' => $addon['options'][1]['price'],
				'gal640' => $addon['options'][2]['price'],
			);
		}

		echo '<script>var containerPricing = ' . json_encode($container_pricing) . '</script>';

		if(isset($_GET['debug']) && filter_input(INPUT_GET, 'debug') == 1){
			echo "<script>window.bevCalcDebug = true;</script>";
		}
		echo file_get_contents(plugins_url( 'templates/calculator.html', __FILE__ ));
		echo file_get_contents(plugins_url( 'templates/right-half.html', __FILE__ ));
		return ob_get_clean();
	}

	public function conditionally_load_assets() {
		global $post;
		if( is_a( $post, 'WP_Post' ) && has_shortcode( $post->post_content, 'coffee-calculator') ) {

			wp_enqueue_script(
				'simple-slider',
				plugins_url( 'vendor/simple-slider.min.js', __FILE__  ),
				array( 'jquery' ), true, false);

			wp_enqueue_script(
				'coffee-calculator',
				plugins_url( 'dcc-coffee-calculator.js', __FILE__  ),
				array( 'simple-slider' ), true, false);

			wp_enqueue_style( 'simple-slider',     plugins_url( 'vendor/simple-slider.css' , __FILE__ ) );
			wp_enqueue_style( 'coffee-calculator', plugins_url( 'dcc-coffee-calculator.css', __FILE__ ) );
		}
	}

}
