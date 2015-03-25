/**
 * Created by jhzhang on 2014/12/22.
 */
angular.module('ngDolphin',['dp.validator','dp.dialog','dp.errorHandler','dp.widgets']);
/*
 * form validator
 * */
angular.module('dp.validator',['ng'])
    .provider('dpValidator',[function(){
        var defaultTips = {
            required      : "该选项不能为空",
            maxlength     : "该选项输入值长度不能大于{maxlength}",
            minlength     : "该选项输入值长度不能小于{minlength}",
            email         : "输入邮件的格式不正确",
            repeat        : "两次输入不一致",
            pattern       : "该选项输入格式不正确",
            number        : "必须输入数字",
            unique        : "该输入值已经存在，请重新输入",
            url           : "输入URL格式不正确",
            date          : "输入日期格式不正确",
            max           : "该选项输入值不能大于{max}",
            min           : "该选项输入值不能小于{min}"
        };

        var defaultRules = {
            int:{
                rule:/^\d+$/,
                pattern:"此项只能输入整数"
            },
            cn:{
                rule:/^[\u4e00-\u9fa5]+$/,
                pattern:'此字段只能用中文字符'
            },
            notcn:{
                rule:/^(?!.*[\u4e00-\u9fa5]).*$/,
                pattern:'此字段不能含有中文字符'
            },
            en:{
                rule:/^[a-zA-Z]+$/,
                pattern:'此字段只能用英文字符'
            },
            normal:{
                rule:/^[-\w]+$/,
                pattern:'此字段不能含有特殊字符'
            }
        };
        var defaultConfig = {
            blurTrigger:true,
            tipPos:'right',
            showAllTip:true
        };

        var inputType = ['text','password','email','number','url','textarea','select'];
        var replaceTips = ['max','min','maxlength','minlength'];
        var tipHtml = '<div class="form_vali_tip {{classes}}"><div class="form_vali_tip_con"><i></i><span>{{msg}}</span></div></div>';

        var ValidatorFn = function(){
            this.config = defaultConfig;
            this.rules = defaultRules;
            this.inputType = inputType;
        };
        ValidatorFn.prototype = {
            constructor:ValidatorFn,
            config:function(config){
                this.config = angular.extend(this.config,config);
            },
            setRule:function(rule){
                this.rules = angular.extend(this.rules,rule);
            },
            getErrorMsg:function(el,opts,errors){
                var rule = el.attr('rule')||'',msg, e,att;
                for(var err in errors){
                    if(errors[err]){
                        e = err;
                        msg = this.rules[rule] && this.rules[rule][err];
                    }
                }
                msg = opts[e] || msg || defaultTips[e] || '';

                if(replaceTips.indexOf(e) > -1){
                    att = e === 'maxlength' ? 'ng-maxlength' : e=== 'minlength' ? 'ng-minlength': e;
                    msg = msg.replace(new RegExp('\\{'+ e + '\\}','ig'),el.attr(att));
                }
                return msg;
            },
            showErrorMsg:function(el,opts,errors){
                var $parent = el.parent(),
                    $tip = $parent.find('div.form_vali_tip'),
                    obj = {
                        msg:this.getErrorMsg(el,opts,errors),
                        classes:opts.tipPos || this.config.tipPos
                    };
                $tip.length !== 0 && ($tip.remove());
                $parent.append(tipHtml.replace(/\{\{(\w+?)\}\}/g,function(a,b){ return obj[b]}));

                el.removeClass('dp_valid').addClass('dp_invalid');
            },
            hideErrorMsg:function(el){
                var $parent = el.parent(),
                    $tip = $parent.find('div.form_vali_tip');

                $tip.length !== 0 && ($tip.remove());
                el.removeClass('dp_invalid').addClass('dp_valid');
            }
        };

        var validator = new ValidatorFn();

        this.config = function(config){
            validator.config(config);
        };

        this.setRule = function(rule){
            validator.setRule(rule);
        };

        this.setTip = function(tip){
            defaultTips = angular.extend(defaultTips, tip);
        };

        this.$get = function(){
            return validator;
        }
    }])
    .directive('dpFormValidator',['$parse','$timeout','dpValidator',function($parse,$timeout,dpValidator){
        return {
            controller:['$scope',function($scope){
                this.form = null;
                this.doValidate = function(callback){
                    if(angular.isFunction(this.form.doValidate)){
                        this.form.doValidate(callback)
                    }
                }
            }],
            compile:function(form,attr){
                var form = form[0],i= 0,len = form.length,field,ruleName;
                var defaultRules = dpValidator.rules;
                for(;i<len;i++){
                    field = form[i];
                    //取验证规则名称
                    ruleName = field.getAttribute('rule');
                    if(ruleName in defaultRules){
                        //绑定验证规则
                        if(defaultRules[ruleName]['rule']){
                            field.setAttribute('ng-pattern',defaultRules[ruleName]['rule']);
                        }
                    }
                }
                return {
                    post:function(scope,form,attr,ctrl){
                        var form = form[0],
                            i= 0,
                            len=form.length,
                            formName = attr.name,
                            beforeValidatorFn = $parse(attr.dpBeforeValidator),
                            afterValidatorFn = $parse(attr.dpAfterValidator),
                            dpSubmit = $parse(attr.dpSubmit),
                            config = scope.$eval(attr.dpFormValidator);

                        var valiItem = function(field){
                            if(dpValidator.inputType.indexOf(field.type) === -1) return;

                            var fieldName = field.name,
                                $el = angular.element(field),
                                option = scope.$eval(field.getAttribute('option'));

                            option = angular.extend({}, dpValidator.config, option);

                            if(!scope[formName][fieldName].$valid){
                                dpValidator.showErrorMsg($el,option,scope[formName][fieldName].$error);
                                return false;
                            }else{
                                dpValidator.hideErrorMsg($el);
                                return true;
                            }
                        };

                        var watchItem = function(field){
                            if(dpValidator.inputType.indexOf(field.type) === -1) return;
                            var $viewValueName,
                                fieldName = field.name;

                            $viewValueName = formName + "." + fieldName + ".$viewValue";
                            //如果值在变化，则去掉错误提示信息
                            scope.$watch($viewValueName,function(){
                                dpValidator.hideErrorMsg(angular.element(field));
                            });
                        };

                        ctrl.form = scope[formName];

                        //考虑如果有表单元素是异步加载到form中的情况
                        scope.$watch(function(){
                            return form.length;
                        },function(newLength){
                            len = newLength
                        });

                        //watch配置
                        if(attr.dpFormValidator){
                            scope.$watch(attr.dpFormValidator,function(newValue){
                                if(newValue){
                                    config = angular.extend({}, dpValidator.config, newValue);
                                }
                            })
                        }

                        config = angular.extend({}, dpValidator.config, config);

                        for(;i<len;i++){
                            (function(i){
                                watchItem(form[i]);
                                if(config.blurTrigger){
                                    angular.element(form[i]).on('blur',function(){
                                        valiItem(this);
                                    });
                                }
                            })(i);
                        }
                        var doValidate = function(callback){
                            var i= 0, field, $field,fieldName,beforeValidator,afterValidator;
                            //验证前执行函数，如果返回false，则不执行验证
                            if(attr.dpBeforeValidator){
                                beforeValidator = scope[formName].$error['beforeValidator'] = beforeValidatorFn(scope)() === false;
                                if(beforeValidator) return false;
                            }

                            //验证所有表单项
                            for(;i<len;i++){
                                valiItem(form[i]);
                            }

                            //验证后执行函数，如果返回false，则不能提交表单
                            if(attr.dpAfterValidator){
                                afterValidator  = scope[formName].$error['afterValidator'] = afterValidatorFn(scope)() === false;
                                if(afterValidator) return false;
                            }

                            //验证通过后执行提交函数
                            if (scope[formName].$valid && angular.isFunction(callback)){
                                scope.$apply(function(){
                                    callback(scope);
                                });
                            }
                        };

                        scope[formName].doValidate = doValidate;
                        if(attr.dpSubmit && angular.isFunction(dpSubmit)){
                            angular.element(form).on('submit',function(){
                                doValidate(dpSubmit(scope));
                            })
                        }
                    }
                }
            }
        }
    }])
    .directive('dpFormSubmit',['$parse',function($parse){
        return {
            require:'^dpFormValidator',
            link:function(scope, element, attr, ctrl){
                var dpSubmit = $parse(attr.dpFormSubmit);
                element.on('click',function(){
                    ctrl.doValidate(dpSubmit(scope));
                });
            }
        }
    }])
    .directive('dpRepeat',[function(){
        return {
            require:'ngModel',
            link:function(scope, elem, attrs, ctrl){
                var otherInput = elem.inheritedData("$formController")[attrs.dpRepeat];
                ctrl.$parsers.push(function(value){
                    ctrl.$setValidity("repeat", value === otherInput.$viewValue);
                    return value;
                });

                otherInput.$parsers.push(function(value){
                    ctrl.$setValidity("repeat", value === ctrl.$viewValue);
                    return value;
                });
            }
        }
    }])
    .directive('dpBackCheck',['$timeout','$http','dpValidator',function($timeout,$http,dpValidator){
        return {
            require:'ngModel',
            link:function(scope, elem, attrs, ctrl){
                var $el = angular.element(elem),
                    checkUrl = attrs['dpBackCheck'] || dpValidator.rules[attrs.rule]['backcheck'],
                    timer= null, postData = {};
                var doValidate = function(){
                    postData[attrs.name] = ctrl.$viewValue;
                    $http.post(checkUrl,postData).success(function(data){
                        ctrl.$setValidity('unique', data.data === true);
                    });
                };

                scope.$watch(attrs.ngModel,function(nv){
                    if(nv && ctrl.$dirty){
                        if(timer) clearTimeout(timer);
                        timer = setTimeout(function(){
                            doValidate();
                        },500);
                    }
                });

                $el.on('blur',function(){
                    $timeout(function(){
                        if (ctrl.$invalid && !ctrl.$error.unique) return;
                        doValidate();
                    },0);
                });
            }
        }
    }])
    .directive('dpValiHelp',['$parse',function($parse){
        return {
            require:'ngModel',
            link:function(scope, elem, attrs, ctrl){
                var helpFn = $parse(attrs.dpValiHelp);
                ctrl.$parsers.push(function(value){
                    var err = helpFn(scope)(value) === false;
                    ctrl.$setValidity('pattern',!err);
                    return !err ? value : 'undefined'
                })
            }
        }
    }]);
/*
 * dialog 依赖ui-bootstrap 的 $modal
 * */
angular.module('dp.dialog',[])
    .factory('dpDialog',['$templateCache','$http', function($templateCache,$http){
        var dialogs = top['dp_dialog'] || (top['dp_dialog'] = []);
        var openModal = function(template,opts,callback){
            dialogs.push(
                {
                    'dialog':top.$modal.open(angular.extend({
                        templateUrl: template,
                        controller: ['$scope', '$modalInstance', function ($scope, $modalInstance) {
                            $scope.title = opts.title || 'Confirm';
                            $scope.content = opts.content || '';
                            $scope.from = opts.from || '';
                            $scope.cancel = function () {
                                dialogs.pop();
                                angular.isFunction(callback) && callback(false);
                                $modalInstance.dismiss('cancel');
                            };
                            $scope.confirm = function () {
                                dialogs.pop();
                                angular.isFunction(callback) && callback(true);
                                $modalInstance.dismiss('cancel');
                            };
                        }]
                    },opts)),
                    'from':opts.from
                }
            );
        };
        var openModalForFragment = function(opts){
            var tmp = $templateCache.get('dp-dialog/load-fragment'),_opts = _.omit(opts,['controller']);
            $http.get(opts.content).then(function(data){
                var template = tmp.replace(/\{\{content\}\}/,data.data).replace(/\{\{controller\}\}/,opts.controller);
                dialogs.push({
                    'dialog':top.$modal.open(angular.extend({
                        template:template,
                        controller:['$scope', '$modalInstance', function ($scope, $modalInstance) {
                            $scope.title = opts.title || 'Confirm';
                            $scope.cancel = function () {
                                dialogs.pop();
                                $modalInstance.dismiss('cancel');
                            };
                        }]
                    },_opts)),
                    'from':opts.from ||'top'
                });
            },function(error){
                throw new Error(error.data);
            });
        };
        return {
            alert:function(opts,callback){
                opts = angular.extend({size:'sm',windowClass:'dp-dialog-alert'},opts);
                openModal('dp-dialog/alert',opts,callback);
            },
            confirm:function(opts,callback){
                opts = angular.extend({windowClass:'dp-dialog-confirm'},opts);
                openModal('dp-dialog/confirm',opts,callback);
            },
            loadIframe:function(opts,callback){
                opts = angular.extend({size:'lg',windowClass:'dp-dialog-load-iframe'},opts);
                openModal('dp-dialog/load-iframe',opts,callback);
            },
            loadFragment:function(opts){
                opts = angular.extend({size:'lg',windowClass:'dp-dialog-load-fragment'},opts);
                openModalForFragment(opts);
            },
            close:function(){
                if(dialogs.length === 0) return;
                dialogs.pop()['dialog'].dismiss('cancel');
            },
            closeAll:function(){
                if(dialogs.length === 0) return;
                for(var i= 0,len=dialogs.length;i<len;i++){
                    dialogs.pop()['dialog'].dismiss('cancel');
                }
            }
        }
    }])
    .run(['$templateCache',function($templateCache){
        $templateCache.put('dp-dialog/alert','<div class="modal-header"><a class="dialog-cancel" ng-click="cancel()"><span class="glyphicon glyphicon-remove"></span></a><h3 class="modal-title">{{title}}</h3></div><div class="modal-body user-dialog">{{content}}</div><div class="modal-footer"><button class="btn btn-primary" ng-click="confirm()">Enter</button></div>');
        $templateCache.put('dp-dialog/confirm','<div class="modal-header"><a class="dialog-cancel" ng-click="cancel()"><span class="glyphicon glyphicon-remove"></span></a><h3 class="modal-title">{{title}}</h3></div><div class="modal-body user-dialog">{{content}}</div><div class="modal-footer"><button type="btn" class="btn btn-default" ng-click="cancel()">Cancel</button><button class="btn btn-primary" ng-click="confirm()">Confirm</button></div>');
        $templateCache.put('dp-dialog/load-iframe','<div class="modal-header"><a class="dialog-cancel" ng-click="cancel()"><span class="glyphicon glyphicon-remove"></span></a><h3 class="modal-title">{{title}}</h3></div><div class="modal-body user-dialog"><iframe src="{{content}}" name="{{from}}" id="{{from}}"frameborder="0" width="100%" height="600px"></iframe></div><div class="modal-footer"></div>');
        $templateCache.put('dp-dialog/load-fragment','<div class="modal-header"><a class="dialog-cancel" ng-click="cancel()"><span class="glyphicon glyphicon-remove"></span></a><h3 class="modal-title">{{title}}</h3></div><div class="modal-body user-dialog"><div ng-controller="{{controller}}">{{content}}</div></div>');
    }]);

angular.module('dp.errorHandler',['dp.dialog'])
    .factory('dpErrorHandler',['dpDialog',function(dpDialog){
        var golbalErrors = {
            '1001':{
                'tip':{
                    cn:'请勿重复删除线上数据。'
                }
            },
            '1002':{
                'tip':{
                    cn:'请先将线上数据下架。'
                }
            },
            '1003':{
                'tip':{
                    cn:'请先将数据上传至预发布环境。'
                }
            },
            '1004':{
                'tip':{
                    cn:'资源已被其他资源引用，不能删除'
                }
            },
            '1005':{
                'tip':{
                    cn:'该资源已被其它资源引用,是否确认删除？'
                }
            },
            '1006':{
                'tip':{
                    cn:'文案字段重复，请重新编辑！'
                }
            },
            '1007':{
                'tip':{
                    cn:'图片命名重复，请重新上传!'
                }
            },
            '1008':{
                'tip':{
                    cn:'图片名称包含“中文，（，），url链接’等非法字符，请重新编辑！'
                }
            },
            '1009':{
                'tip':{
                    cn:'图片格式有误，正确的图片格式为：jpg,jpeg,png,gif,bmp.请重新上传！'
                }
            },
            'default':{
                tip:{
                    cn:'操作失败.'
                }
            }
        };

        return function(errors,languge){
            var languge = languge || 'cn';
            this.errors = angular.extend({},golbalErrors,errors);
            this.show = function(errorData){
                var errorData = errorData.data;
                /*考虑两种情况：1.status为空，2.status不为空，但tips里没有相应的数据*/
                var errObj = this.errors[errorData.status || 'default'] || this.errors['default'];
                var serverMsg = errorData.data && errorData.data.msg,
                    msg  = errObj.tip[languge];

                //如果server端有返回msg，需要在前端进行替换，接收数组和字符串两种类型的数据
                if(serverMsg){
                    msg = msg.replace(/\{\{\w+?\}\}/g,function(){ return angular.isArray(serverMsg) ? serverMsg.join(',') : serverMsg })
                }

                //如果有自定义的处理函数,处理函数必须有返回值：msg字符串或者false
                //如果返回false，则不执行后面的语句，这时候需要自己处理如何显示错误信息
                if(angular.isFunction(errObj['handler'])){
                    msg = errObj['handler'].call(errObj,errorData,msg);
                    if(msg === false) return;
                }

                //如果需要二次确认
                if(angular.isFunction(errObj['confirmHandler'])){
                    return dpDialog.confirm({
                        content:msg
                    },function(v){
                        if(v){
                            errObj['confirmHandler'].call(errObj,errorData,msg);
                        }else{
                            dpDialog.close();
                        }
                    })
                }

                toastr.error(msg);
                return this;
            }
        };
    }]);

angular.module('dp.widgets',[])
    .directive('dpSortField',[function(){
        return {
            restrict: 'EA',
            scope:{
                'params':'='
            },
            template:'<i class="fa icon-sort" ng-class="sort === \'desc\' ? \'fa-sort-desc\' : \'fa-sort-asc\'"></i>',
            link:function($scope, $element, $attrs){
                var sortBy = $attrs['sortBy'],multi = $attrs['multi'],sort = [];
                var $els,$el,tmp;
                $scope.sort = $attrs['sort'];
                //如果是组合排序
                if(multi){
                    $els = angular.element('dp-sort-field[multi='+ multi +']');
                    $els.each(function(){
                        $el = angular.element(this);
                        sort.push({'sorgBy':$el.attr('sort-by'),'sort':$el.attr('sort')})
                    });
                }
                tmp = _.indexBy(sort,'sorgBy');
                $element.on('click',function(){
                    $scope.sort = $scope.sort === 'desc' ? 'asc' : 'desc';
                    tmp[sortBy] = {'sortBy':sortBy,'sortWay':$scope.sort};
                    sort = _.values(tmp);
                    $scope.params.sort = sort;
                    $scope.$apply();
                });
            }
        }
    }])
    .factory('dpStorage',[function(){
        return function(storageType){
            var storage = window[storageType], cache,
                getstorageKey = function(){
                    var userSession = window.localStorage.getItem('user_session');
                    return userSession && JSON.parse(userSession)['username'] || ('dp_'+ storageType);
                };
            this.serialize = function(value){
                return JSON.stringify(value);
            };
            this.deserialize = function(value){
                if (typeof value != 'string') {
                    return undefined;
                }
                try {
                    return JSON.parse(value);
                } catch (e) {
                    return value || undefined;
                }
            };
            this.set = function(key,value){
                var argLen = arguments.length,
                    storageKey = getstorageKey();

                if(argLen === 1 && _.isString(key) || argLen === 2 && !_.isString(key)){
                    throw new Error('set '+ storageType + 'exception: arguments error.')
                }
                cache = this.get();
                if(_.isString(key)){
                    cache[key] = value;
                    storage.setItem(storageKey,this.serialize(cache));
                }
                if(_.isObject(key)){
                    storage.setItem(storageKey,this.serialize(_.extend(cache,key)));
                }
                return this;
            };
            this.get = function(key){
                var argLen = arguments.length,
                    storageKey = getstorageKey();

                cache = this.deserialize(storage.getItem(storageKey)) || {};
                return argLen === 0 ? cache : _.isString(key) ? cache[key] : null;
            };
            this.getAll = function(){
                return this.get();
            };
            this.remove = function(key){
                if(!key || !_.isString(key)) return this;
                cache = this.get();
                var keys = _.isString(key) ? [key] : key,
                    storageKey = getstorageKey();
                _.each(keys,function(key){
                    delete  cache[key];
                });
                storage.setItem(storageKey,this.serialize(cache));
            };
            this.clear = function(){
                var storageKey = getstorageKey();
                storage.removeItem(storageKey);
                return this;
            };
        };
    }])
    .factory('dpSession',['dpStorage',function(dpStorage){
        return new dpStorage('sessionStorage');
    }])
    .factory('dpLocal',['dpStorage',function(dpStorage){
        return new dpStorage('localStorage');
    }])
    .directive('dpFile',[function(){
        return {
            restrict: 'E',
            scope:{
                files:'='
            },
            template:'<div class="file-simulation" ng-class="{\'disabled\': beDisabled }"><input type="file" class="input_file" ng-disabled="beDisabled"></div>',
            link:function($scope, $element, $attrs){
                //支持多种格式用|分隔即可
                var fileTypeReg = new RegExp('\\.('+$attrs['fileType'].toLowerCase().replace(/\s+/g,'')+')$'),
                    quantity = $attrs['quantity'],
                    size = $attrs['fileSize'],
                    fileSize = parseFloat(size) * 1024 * (/[mM]$/.test(size) ? 1024 : 1) || 1*1024*1024,
                    $fileInput = $element.find('input');

                $scope.files = $scope.files || [];

                $scope.$watchCollection('files',function(files){
                    $scope.beDisabled = files.length >= quantity;
                });

                $fileInput.on('change',function(){
                    var file = this.files[0];
                    if(this.value === '') return;
                    //如果文件格式不对，或者文件大小超出限制
                    if(!fileTypeReg.test(file.name) || file.size > fileSize){
                        this.value = '';
                        file = this.files[0];
                        throw new Error('文件格式不对，或文件大小超出限制');
                        return;
                    }

                    $scope.files.push(file);
                    $scope.$apply();
                });
            }
        }
    }]);