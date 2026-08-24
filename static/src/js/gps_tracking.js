/**
 * MESSOB Fleet GPS Tracking JavaScript
 * Handles real-time GPS tracking and map integration
 */

odoo.define('mesob_fleet_customizations.gps_tracking', function (require) {
    'use strict';

    var AbstractAction = require('web.AbstractAction');
    var core = require('web.core');
    var rpc = require('web.rpc');

    console.log('✅ MESOB Fleet GPS tracking assets loaded successfully');

    var GPSTracking = AbstractAction.extend({
        template: 'GPSTracking',
        
        init: function(parent, context) {
            this._super(parent, context);
            this.tracking_data = {};
            this.update_interval = null;
        },

        willStart: function() {
            var self = this;
            return this._super().then(function() {
                return self.fetch_gps_data();
            });
        },

        start: function() {
            var self = this;
            return this._super().then(function() {
                self.render_tracking_view();
                self.start_real_time_updates();
            });
        },

        fetch_gps_data: function() {
            var self = this;
            return rpc.query({
                model: 'mesob.gps.log',
                method: 'get_latest_positions',
                args: [],
            }).then(function(result) {
                self.tracking_data = result;
            }).catch(function(error) {
                console.warn('⚠️ GPS data fetch failed:', error);
                self.tracking_data = {
                    vehicles: [],
                    last_update: new Date().toISOString()
                };
            });
        },

        render_tracking_view: function() {
            var self = this;
            if (self.tracking_data) {
                self.$('.o_gps_tracking').html(
                    core.qweb.render('GPSTrackingView', {
                        widget: self,
                        data: self.tracking_data
                    })
                );
            }
        },

        start_real_time_updates: function() {
            var self = this;
            // Update GPS positions every 30 seconds
            self.update_interval = setInterval(function() {
                self.fetch_gps_data().then(function() {
                    self.render_tracking_view();
                });
            }, 30000);
        },

        destroy: function() {
            if (this.update_interval) {
                clearInterval(this.update_interval);
            }
            this._super();
        },

        on_vehicle_clicked: function(ev) {
            ev.preventDefault();
            var vehicle_id = $(ev.currentTarget).data('vehicle-id');
            
            if (vehicle_id) {
                this.do_action({
                    type: 'ir.actions.act_window',
                    res_model: 'fleet.vehicle',
                    res_id: vehicle_id,
                    views: [[false, 'form']],
                    target: 'current'
                });
            }
        }
    });

    core.action_registry.add('gps_tracking', GPSTracking);

    return GPSTracking;
});
