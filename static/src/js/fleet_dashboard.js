/**
 * MESSOB Fleet Management Dashboard JavaScript
 * Handles dashboard interactions and real-time updates
 */

odoo.define('mesob_fleet_customizations.dashboard', function (require) {
    'use strict';

    var AbstractAction = require('web.AbstractAction');
    var core = require('web.core');
    var rpc = require('web.rpc');

    console.log('✅ MESOB Fleet dashboard assets loaded successfully');

    var FleetDashboard = AbstractAction.extend({
        template: 'FleetDashboard',
        
        init: function(parent, context) {
            this._super(parent, context);
            this.dashboards_templates = ['DashboardFleet'];
        },

        willStart: function() {
            var self = this;
            return this._super().then(function() {
                return self.fetch_data();
            });
        },

        start: function() {
            var self = this;
            return this._super().then(function() {
                self.render_dashboards();
                self.setup_refresh_timer();
            });
        },

        fetch_data: function() {
            var self = this;
            return rpc.query({
                model: 'fleet.vehicle',
                method: 'get_dashboard_data',
                args: [],
            }).then(function(result) {
                self.dashboard_data = result;
            }).catch(function(error) {
                console.warn('⚠️ Dashboard data fetch failed:', error);
                self.dashboard_data = {
                    total_vehicles: 0,
                    active_vehicles: 0,
                    maintenance_due: 0,
                    recent_trips: []
                };
            });
        },

        render_dashboards: function() {
            var self = this;
            if (self.dashboard_data) {
                self.$('.o_fleet_dashboard').html(
                    core.qweb.render('DashboardFleet', {
                        widget: self,
                        data: self.dashboard_data
                    })
                );
            }
        },

        setup_refresh_timer: function() {
            var self = this;
            // Refresh dashboard every 5 minutes
            setInterval(function() {
                self.fetch_data().then(function() {
                    self.render_dashboards();
                });
            }, 300000);
        },

        on_dashboard_action_clicked: function(ev) {
            ev.preventDefault();
            var $action = $(ev.currentTarget);
            var action_name = $action.attr('name');
            
            if (action_name) {
                this.do_action(action_name);
            }
        }
    });

    core.action_registry.add('fleet_dashboard', FleetDashboard);

    return FleetDashboard;
});
