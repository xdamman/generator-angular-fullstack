'use strict';

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import {Base} from 'yeoman-generator';
import {genBase} from '../generator-base';
import insight from '../insight-init';
import {exec} from 'child_process';

export default class Generator extends Base {

  constructor(...args) {
    super(...args);

    this.argument('name', { type: String, required: false });

    this.option('skip-install', {
      desc: 'Do not install dependencies',
      type: Boolean,
      defaults: false
    });

    this.option('app-suffix', {
      desc: 'Allow a custom suffix to be added to the module name',
      type: String,
      defaults: 'App'
    });
  }

  get initializing() {
    return {
      init: function () {
        var cb = this.async();

        this.config.set('generatorVersion', this.rootGeneratorVersion());
        this.filters = {};

        // init shared generator properies and methods
        genBase(this);

        if(process.env.CI) {
          insight.optOut = true;
          return cb();
        } else if(insight.optOut === undefined) {
          insight.askPermission(null, cb);
        } else {
          return cb();
        }
      },

      info: function () {
        insight.track('generator', this.rootGeneratorVersion());
        insight.track('node', process.version);
        exec('npm --version', (err, stdin, stderr) => {
          if(err || stderr.length > 0) return insight.track('npm', 'error');
          else return insight.track('npm', stdin.toString().trim());
        });
        insight.track('platform', process.platform);

        this.log(this.yoWelcome);
        this.log('Out of the box I create an AngularJS app with an Express server.\n');
      },

      checkForConfig: function() {
        var cb = this.async();
        var existingFilters = this.config.get('filters');

        if(existingFilters) {
          this.prompt([{
            type: 'confirm',
            name: 'skipConfig',
            message: 'Existing .yo-rc configuration found, would you like to use it?',
            default: true,
          }], function (answers) {
            this.skipConfig = answers.skipConfig;

            if(this.skipConfig) {
              insight.track('skipConfig', 'true');
              this.filters = existingFilters;

              this.scriptExt = this.filters.ts ? 'ts' : 'js';
              this.templateExt = this.filters.jade ? 'jade' : 'html';
              this.styleExt = this.filters.sass ? 'scss' : 
                this.filters.less ? 'less' : 
                this.filters.stylus ? 'styl' : 
                'css';
            } else {
              insight.track('skipConfig', 'false');
              this.filters = {};
              this.forceConfig = true;
              this.config.set('filters', this.filters);
              this.config.forceSave();
            }

            cb();
          }.bind(this));
        } else {
          cb();
        }
      }
    };
  }

  get prompting() {
    return {

      clientPrompts: function() {
        if(this.skipConfig) return;
        var cb = this.async();

        this.log('# Client\n');

        this.prompt([{
            type: 'list',
            name: 'transpiler',
            message: 'What would you like to write scripts with?',
            choices: ['Babel', 'TypeScript'],
            filter: val => {
              return {
                'Babel': 'babel',
                'TypeScript': 'ts'
              }[val];
            }
          }, {
            type: 'list',
            name: 'markup',
            message: 'What would you like to write markup with?',
            choices: ['HTML', 'Jade'],
            filter: function( val ) { return val.toLowerCase(); }
          }, {
            type: 'list',
            name: 'stylesheet',
            default: 1,
            message: 'What would you like to write stylesheets with?',
            choices: [ 'CSS', 'Sass', 'Stylus', 'Less'],
            filter: function( val ) { return val.toLowerCase(); }
          },  {
            type: 'list',
            name: 'router',
            default: 1,
            message: 'What Angular router would you like to use?',
            choices: [ 'ngRoute', 'uiRouter'],
            filter: function( val ) { return val.toLowerCase(); }
          }, {
            type: 'confirm',
            name: 'bootstrap',
            message: 'Would you like to include Bootstrap?'
          }, {
            type: 'confirm',
            name: 'uibootstrap',
            message: 'Would you like to include UI Bootstrap?',
            when: function (answers) {
              return answers.bootstrap;
            }
          }], function (answers) {
            this.filters.js = true;
            this.filters[answers.transpiler] = true;
            insight.track('transpiler', answers.transpiler);

            this.filters[answers.markup] = true;
            insight.track('markup', answers.markup);

            this.filters[answers.stylesheet] = true;
            insight.track('stylesheet', answers.stylesheet);

            this.filters[answers.router] = true;
            insight.track('router', answers.router);

            this.filters.bootstrap = !!answers.bootstrap;
            insight.track('bootstrap', !!answers.bootstrap);

            this.filters.uibootstrap =  !!answers.uibootstrap;
            insight.track('uibootstrap', !!answers.uibootstrap);

            this.scriptExt = answers.transpiler === 'ts' ? 'ts' : 'js';
            this.templateExt = answers.markup;

            var styleExt = {sass: 'scss', stylus: 'styl'}[answers.stylesheet];
            this.styleExt = styleExt ? styleExt : answers.stylesheet;

            cb();
          }.bind(this));
      },

      serverPrompts: function() {
        if(this.skipConfig) return;
        var cb = this.async();
        var self = this;

        this.log('\n# Server\n');

        this.prompt([{
          type: 'checkbox',
          name: 'odms',
          message: 'What would you like to use for data modeling?',
          choices: [
            {
              value: 'mongoose',
              name: 'Mongoose (MongoDB)',
              checked: true
            },
            {
              value: 'sequelize',
              name: 'Sequelize (MySQL, SQLite, MariaDB, PostgreSQL)',
              checked: false
            }
          ]
        }, {
          type: 'list',
          name: 'models',
          message: 'What would you like to use for the default models?',
          choices: [ 'Mongoose', 'Sequelize' ],
          filter: function( val ) {
            return val.toLowerCase();
          },
          when: function(answers) {
            return answers.odms && answers.odms.length > 1;
          }
        }, {
          type: 'confirm',
          name: 'auth',
          message: 'Would you scaffold out an authentication boilerplate?',
          when: function (answers) {
            return answers.odms && answers.odms.length !== 0;
          }
        }, {
          type: 'checkbox',
          name: 'oauth',
          message: 'Would you like to include additional oAuth strategies?',
          when: function (answers) {
            return answers.auth;
          },
          choices: [
            {
              value: 'googleAuth',
              name: 'Google',
              checked: false
            },
            {
              value: 'facebookAuth',
              name: 'Facebook',
              checked: false
            },
            {
              value: 'twitterAuth',
              name: 'Twitter',
              checked: false
            }
          ]
        }, {
          type: 'confirm',
          name: 'socketio',
          message: 'Would you like to use socket.io?',
          // to-do: should not be dependent on ODMs
          when: function (answers) {
            return answers.odms && answers.odms.length !== 0;
          },
          default: true
        }], function (answers) {
          if(answers.socketio) this.filters.socketio = true;
          insight.track('socketio', !!answers.socketio);

          if(answers.auth) this.filters.auth = true;
          insight.track('auth', !!answers.auth);

          if(answers.odms && answers.odms.length > 0) {
            var models;
            if(!answers.models) {
              models = answers.odms[0];
            } else {
              models = answers.models;
            }
            this.filters.models = true;
            this.filters[models + 'Models'] = true;
            answers.odms.forEach(function(odm) {
              this.filters[odm] = true;
            }.bind(this));
            insight.track('oauth', !!answers.oauth);
          } else {
            this.filters.noModels = true;
          }
          insight.track('odms', answers.odms && answers.odms.length > 0);
          insight.track('mongoose', !!this.filters.mongoose);
          insight.track('mongooseModels', !!this.filters.mongooseModels);
          insight.track('sequelize', !!this.filters.sequelize);
          insight.track('sequelizeModels', !!this.filters.sequelizeModels);

          if(answers.oauth) {
            if(answers.oauth.length) this.filters.oauth = true;
            answers.oauth.forEach(function(oauthStrategy) {
              this.filters[oauthStrategy] = true;
            }.bind(this));
          }
          insight.track('oauth', !!this.filters.oauth);
          insight.track('google-oauth', !!this.filters['googleAuth']);
          insight.track('facebook-oauth', !!this.filters['facebookAuth']);
          insight.track('twitter-oauth', !!this.filters['twitterAuth']);

          cb();
        }.bind(this));
      },

      projectPrompts: function() {
        if(this.skipConfig) return;
        var cb = this.async();
        var self = this;

        this.log('\n# Project\n');

        this.prompt([{
          type: 'list',
          name: 'buildtool',
          message: 'Would you like to use Gulp or Grunt?',
          choices: ['Grunt', 'Gulp'],
          default: 0,
          filter: val => val.toLowerCase()
        }, {
          type: 'list',
          name: 'testing',
          message: 'What would you like to write tests with?',
          choices: [ 'Jasmine', 'Mocha + Chai + Sinon'],
          filter: function( val ) {
            var filterMap = {
              'Jasmine': 'jasmine',
              'Mocha + Chai + Sinon': 'mocha'
            };

            return filterMap[val];
          }
        }, {
          type: 'list',
          name: 'chai',
          message: 'What would you like to write Chai assertions with?',
          choices: ['Expect', 'Should'],
          filter: function( val ) {
            return val.toLowerCase();
          },
          when: function( answers ) {
            return  answers.testing === 'mocha';
          }
        }], function (answers) {
          this.filters[answers.buildtool] = true;
          insight.track('buildtool', answers.buildtool);

          this.filters[answers.testing] = true;
          insight.track('testing', answers.testing);
          if (answers.testing === 'mocha') {
            this.filters.jasmine = false;
            this.filters.should = false;
            this.filters.expect = false;
            this.filters[answers.chai] = true;
            insight.track('chai-assertions', answers.chai);
          }
          if (answers.testing === 'jasmine') {
            this.filters.mocha = false;
            this.filters.should = false;
            this.filters.expect = false;
          }

          cb();
        }.bind(this));
      }

    };
  }

  get configuring() {
    return {

      saveSettings: function() {
        if(this.skipConfig) return;
        this.config.set('endpointDirectory', 'server/api/');
        this.config.set('insertRoutes', true);
        this.config.set('registerRoutesFile', 'server/routes.js');
        this.config.set('routesNeedle', '// Insert routes below');

        this.config.set('routesBase', '/api/');
        this.config.set('pluralizeRoutes', true);

        this.config.set('insertSockets', true);
        this.config.set('registerSocketsFile', 'server/config/socketio.js');
        this.config.set('socketsNeedle', '// Insert sockets below');

        this.config.set('insertModels', true);
        this.config.set('registerModelsFile', 'server/sqldb/index.js');
        this.config.set('modelsNeedle', '// Insert models below');

        this.config.set('filters', this.filters);
        this.config.forceSave();
      },

      ngComponent: function() {
        if(this.skipConfig) return;
        var appPath = 'client/app/';
        var extensions = [];
        var filters = [
          'ngroute',
          'uirouter',
          'jasmine',
          'mocha',
          'expect',
          'should'
        ].filter(function(v) {return this.filters[v];}, this);

        if(this.filters.ngroute) filters.push('ngroute');
        if(this.filters.uirouter) filters.push('uirouter');
        if(this.filters.babel) extensions.push('babel');
        if(this.filters.ts) extensions.push('ts');
        if(this.filters.js) extensions.push('js');
        if(this.filters.html) extensions.push('html');
        if(this.filters.jade) extensions.push('jade');
        if(this.filters.css) extensions.push('css');
        if(this.filters.stylus) extensions.push('styl');
        if(this.filters.sass) extensions.push('scss');
        if(this.filters.less) extensions.push('less');

        filters.push('es6'); // Generate ES6 syntax code

        this.composeWith('ng-component', {
          options: {
            'routeDirectory': appPath,
            'directiveDirectory': appPath,
            'filterDirectory': appPath,
            'serviceDirectory': appPath,
            'filters': filters,
            'extensions': extensions,
            'basePath': 'client',
            'forceConfig': this.forceConfig
          }
        }, { local: require.resolve('generator-ng-component/app/index.js') });
      },

      ngModules: function() {
        var angModules = [
          `'${this.scriptAppName}.constants'`,
          "'ngCookies'",
          "'ngResource'",
          "'ngSanitize'"
        ];
        if(this.filters.ngroute) angModules.push("'ngRoute'");
        if(this.filters.socketio) angModules.push("'btford.socket-io'");
        if(this.filters.uirouter) angModules.push("'ui.router'");
        if(this.filters.uibootstrap) angModules.push("'ui.bootstrap'");
        if(this.filters.auth) {
          angModules.unshift(`'${this.scriptAppName}.admin'`);
          angModules.unshift(`'${this.scriptAppName}.auth'`);
          angModules.push("'validation.match'");
        }

        this.angularModules = '\n  ' + angModules.join(',\n  ') +'\n';
      }

    };
  }

  get default() {
    return {};
  }

  get writing() {
    return {

      generateProject: function() {
        let self = this;
        this.sourceRoot(path.join(__dirname, './templates'));
        this.processDirectory('.', '.', function(dest) {
          if(self.filters.ts && dest.indexOf('client') > -1 && dest.indexOf('.json') === -1) {
            dest = dest.replace('.js', '.ts');
          }

          return dest;
        });
      },

      generateEndpoint: function() {
        var models;
        if (this.filters.mongooseModels) {
          models = 'mongoose';
        } else if (this.filters.sequelizeModels) {
          models = 'sequelize';
        }
        this.composeWith('angular-fullstack:endpoint', {
          options: {
            route: '/api/things',
            models: models
          },
          args: ['thing']
        });
      }

    };
  }

  get install() {
    return {

      installDeps: function() {
        this.installDependencies({
          skipInstall: this.options['skip-install']
        });
      }

    };
  }

  get end() {
    return {};
  }

}
