$(document).ready(function() {
    var collection = null,
        roles = [],
        User = Parse.User.extend({
            initialize: function () {
                var model = this;
                this.on('change', function () {
                    if (this.id && this.changedAttributes()) {
                        Parse.Cloud.run('saveUser', {
                            user: this.id,
                            username: this.getUsername(),
                            roles: this.get('roles')
                        });
                    }
                }, this);
                this.on('change:username', function () {
                    if (!this.id && !this.get('tempPassword') && this.getUsername()) {
                        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXTZ";
                        var string_length = 8;
                        var password = '';
                        for (var i=0; i<string_length; i++) {
                            var rnum = Math.floor(Math.random() * chars.length);
                            password += chars.substring(rnum,rnum+1);
                        }
                        var username = this.getUsername();
                        var roles = this.get('roles');
                        Parse.User.signUp(username, password, {
                            tempPassword: password,
                            roles: roles
                        }).then(function (user) {
                            model.id = user.id;
                            var sessionToken = $('#session').text();
                            return Parse.User.become(sessionToken)
                        }, function (error) {
                            console.log(error.message);
                        }).then(function() {
                            model.fetch();
                        }, function (error) {
                            console.log(error.message);
                        });
                    }
                });
            }
        });

    var UserDeleteCell = Backgrid.Cell.extend({
        template: _.template('<button type="button" class="btn btn-danger"><span class="glyphicon glyphicon-remove"></span></button>'),
        events: {
            "click": "deleteRow"
        },
        className: "delete-cell",
        deleteRow: function (e) {
            e.preventDefault();
            var model = this.model;
            var $modal = $('#delete-modal');
            $modal.find('strong').text(model.get('username'));
            $modal.modal().find('.btn-danger').unbind('click').click(function () {
                Parse.Cloud.run('deleteUser', { user: model.id });
                model.collection.remove(model);
                $modal.modal('hide');
            });
        },
        render: function () {
            this.$el.html(this.template());
            this.delegateEvents();
            return this;
        }
    });

    var RoleSelect2Cell = Backgrid.Extension.Select2Cell.extend({
        multiple: true,
        optionValues: function() {
            return _.map(clientsCollection.models, function(role) {
                return [role.get('name'), role.get('name')];
            });
        },
        formatter: {
            fromRaw: function(role) {
                return role;
            },
            toRaw: function(role) {
                return role;
            }
        },
        editor: Backgrid.Extension.Select2CellEditor.extend({
            save: function () {
                var model = this.model,
                    column = this.column,
                    previous = model.get(column.get('name')) || [],
                    now = this.$el.val() || [],
                    difference = _.difference(previous, now);

                var different = difference.length > 0;
                _.each(difference, function(roleName) {
                    var role = _.find(roles.models, function(role) {
                        return role.get('name') === roleName;
                    });
                    role.relation('users').remove(model);
                    role.save();
                });

                difference = _.difference(now, previous);
                if (!different && difference.length > 0) {
                    different = true;
                }
                _.each(difference, function(roleName) {
                    var role = _.find(roles.models, function(role) {
                        return role.get('name') === roleName;
                    });
                    role.relation('users').add(model);
                    role.save();
                });

                if (different) {
                    model.set(column.get('name'), this.formatter.toRaw(this.$el.val() || [], model));
                }
            }
        })
    });

    var users = function() {};

    users.prototype = {
        init: function() {
            if (!collection) {
                $('#activity').activity();
                var queries = [];
                if (clientsCollection.length == 0) {
                    queries.push(clientsCollection.fetch());
                }
                var query = new Parse.Query(User);
                collection = query.collection();
                queries.push(collection.fetch());
                var roleQuery = new Parse.Query(Parse.Role);
                roles = roleQuery.collection();
                queries.push(roles.fetch());
                Parse.Promise.when(queries).then(function () {
                    var users = _.reject(collection.models, function (user) {
                        return _.contains(user.get('roles'), 'Administrator');
                    });
                    collection.reset(users);
                    var columns = [{
                        name: "username",
                        label: "Email",
                        cell: "string"
                    }, {
                        name: "tempPassword",
                        label: "Temporary Password",
                        cell: "string",
                        editable: false,
                        sortable: false
                    }, {
                        name: "roles",
                        label: "Clients",
                        cell: RoleSelect2Cell,
                        sortable: false
                    }, {
                        label: "",
                        sortable: false,
                        editable: false,
                        cell: UserDeleteCell
                    }];

                    var grid = new Backgrid.Grid({
                        columns: columns,
                        collection: collection,
                        className: "backgrid table-bordered"
                    });

                    $('#users-table').append(grid.render().el);

                    $('#add-user').click(function () {
                        collection.comparator = null;
                        collection.add(new User({
                            roles: []
                        }), {
                            at: 0
                        });
                    });

                    $('#activity').activity(false);
                });
            }
        }
    };

    window.users = new users;
});
