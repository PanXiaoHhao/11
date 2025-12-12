jQuery(function(){
    if (jQuery("#dosub")){
        jQuery("#dosub").attr("autocomplete","off");
    }
	uuid16="smdljwxt"+uuid(16, 32);
	if(document.documentMode>7||document.documentMode==undefined){
		jQuery("#qrCode").addClass("qrCodeCompatible");
	}
	
	jQuery("#qrCode").qrcode({
		render : "table",    //设置渲染方式，有table和canvas，使用canvas方式渲染性能相对来说比较好
		text : uuid16,    //扫描二维码后显示的内容,可以直接填一个网址，扫描二维码后自动跳向该链接
		width : "170",               //二维码的宽度
		height : "170",              //二维码的高度
		background : "#ffffff",      //二维码的后景色
		foreground : "#000000",      //二维码的前景色
		src: 'photo.jpg'             //二维码中间的图片
	});
	
	jQuery("#qrCode").append("<img style='position:absolute; left:548px; top:64px; border:#000 solid 1px;height:40px;width:40px;' src='"+_webRootPath+"frame/themes/kingo/images/xqeicon.png'></img>");
	
	jQuery(".loginImg").click(function(){
		if(this.id=="loginImg"){
			changelogin();
			scanflag=false;
			isXqeScanQrCode=true;
		}else{
			setTimeout(changelogin,120000);//
			changelogin1();
			scanflag=false;
			isXqeScanQrCode=false;
			if(interceptEvent){
				interceptEvent=false;
				setTimeout(function(){
					scanflag=true;
					interceptEvent=true;
					scanQrCode();
				},3000);
			}
		}
	})		
});

function uuid(len, radix) {
    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
    var uuid = [], i;
    radix = radix || chars.length;
 
    if (len) {
      // Compact form
      for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];
    } else {
      // rfc4122, version 4 form
      var r;
 
      // rfc4122 requires these characters
      uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
      uuid[14] = '4';
 
      // Fill in random data.  At i==19 set the high bits of clock sequence as
      // per rfc4122, sec. 4.1.5
      for (i = 0; i < 36; i++) {
        if (!uuid[i]) {
          r = 0 | Math.random()*16;
          uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
        }
      }
    }
 
    return uuid.join('');
}

function scanQrCode(){
	var _url=_webRootPath+"frame/LoginBar.jsp";
	jQuery.post(_url, { operate:"query" ,qrCode:uuid16},
		function(data){
			//alert("data:"+data);
			if(data){
				scanflag=false;
				jQuery("#username").val(data);
				jQuery("#password").val(uuid16);
				doBarLogin();
			}else{
				if(scanflag){
					setTimeout(scanQrCode,1500);
				}
			}
		}
	);
}

function setUsernameCookie(){
	var username = document.getElementById("username").value;
	var setCookie = document.getElementById("setCookie");
	if (username==null || username.length == 0){
		return false;
	}
	if(setCookie.checked){
		jQuery.cookie("login_name",username,{expires: 15});
		//jQuery.cookie("login_pwd",new Base64().encode(password),{expires: 15});//base64(jquery.base64.js)进行加密
	}else{ 
		jQuery.cookie("login_name", null); 
		//jQuery.cookie("login_pwd", null); 
	}
}

function doBarLogin() {
	//alert("doBarLogin()::");
	var username = document.getElementById("username").value;
	var password = document.getElementById("password").value;
	//alert("username="+username);
	//alert("password="+password);
	//document.getElementById("msg").innerHTML='正在登录……';
	var url = _webRootPath + "cas/logon.action";
	var params = {
			"username" : username,
			"password" : password,
			"loginmethod" : "xiqueer"
		};
	jQuery.ajax({
		type: "POST",
		url: url,
		data: params, 
		dataType: "text",
		async: true,
		success: doPostBarLogon
	})
}

function doPostBarLogon(response) {
	//alert("doPostBarLogon()::response="+response);
	var data = jQuery.parseJSON(response); 
	var status = data.status ;
	var message = data.message ;
	//alert(status+":"+message);
	if ("200" == status) {
		var result = data.result ;
		window.document.location.href = result ;
	}
	else {
		if("407" == status){
			alert(message);
			showMessage("");
		}else{
			showMessage(message);
		}
	}
}

function checkrand() {

	// 输入信息验证
	if (!validate()) {
		return false;
	}
	
	// 验证码正确性验证
	var username = jQuery("#username").val();
	var password = jQuery("#password").val();
    if(password.length>30){
        password.substring(0,30);
    }
    checkpwd(document.getElementById("password"));
	var token = jQuery("#password").val();
	var randnumber = jQuery("#randnumber").val();
	var passwordPolicy = isPasswordPolicy(username, password);
	var url = _webRootPath + "cas/logon.action";
	var txt_mm_expression = document.getElementById("txt_mm_expression").value;
	var txt_mm_length = document.getElementById("txt_mm_length").value;
	var txt_mm_userzh = document.getElementById("txt_mm_userzh").value;
	var hid_flag=document.getElementById("hid_flag").value;
	var hid_dxyzm=document.getElementById("hid_dxyzm").value;
	setUsernameCookie();
	//喜鹊儿扫描登录时以二维码随机字符做密码上传，不加密
	if(isXqeScanQrCode){
		//帐号登录，密码加密
		//password = hex_md5(hex_md5(password));
		password = hex_md5(hex_md5(password)+hex_md5(randnumber.toLowerCase()));
	}
	
	/**
	var params = {
					"yhmc" : username,
					"yhmm" : password,
					"token": token,
					"randnumber": randnumber,
					"isPasswordPolicy" : passwordPolicy
				};
	*/
    reloadScript("kingo_getencypt",_webRootPath+"custom/js/GetKingoEncypt.jsp");
    var p_username = "_u"+randnumber;
	var p_password = "_p"+randnumber;
	if(_tdeskey==""){
        reloadScript("kingo_encypt",_webRootPath+"custom/js/SetKingoEncypt.jsp");
        _tdeskey=_deskey;
        _sessionid=_ssessionid;
        //reloadScript("kingo_encypt",_webRootPath+"custom/js/GetKingoEncypt.jsp");
        //alert(_tdeskey);
    }
	username = base64encode(username+";;"+_sessionid); //For 压力测试去掉 2023.11.2
    //username =username+";;"+_sessionid;//For 压力测试 2023.11.2
	var params = p_username+"="+username+"&"+p_password+"="+password+"&randnumber="+randnumber+"&isPasswordPolicy="+passwordPolicy+
	             "&txt_mm_expression="+txt_mm_expression+"&txt_mm_length="+txt_mm_length+"&txt_mm_userzh="+txt_mm_userzh+"&hid_flag="+hid_flag+"&hidlag=1&hid_dxyzm="+hid_dxyzm;
	//alert("params="+params);
    //alert("_deskey="+_deskey);
	params = getEncParams(params)+"&deskey="+_deskey+"&ssessionid="+_ssessionid; //For 压力测试去掉 2023.11.2
	//alert("encparams="+params);
	doPreLogon();					
	doAjax(url, params, doPostLogon);	
	
	function doPreLogon(){
		jQuery("#msg").html("正在登录......");
		jQuery("#login").attr("disabled", true); 
		//jQuery("#reset").attr("disabled", true);
	}

	function doPostLogon(response) {
		var data = JSON.parse(response); 
		var status = data.status ;
		var message = data.message ;
		var cwcs="0";
		
		if ("200" == status) {
			var result = data.result ;
			window.document.location.href = result ;
		} else {

            if("505"==status){
                showMessage("");
                if(document.getElementById("randpic").style.display==""){
                    refreshImg();
				}
                doMobileYzm(message);
            }
            else{
                if(message.indexOf("|")>-1){
                    cwcs=message.split("|")[1];
                    message=message.split("|")[0];
                }
                if(parseInt(cwcs)>=2 || (message.indexOf("锁定")<=-1 && message.indexOf("账号或密码有误!")<=-1 || yzmbt=="1")){
                    document.getElementById("hid_flag").value="";
                    document.getElementById("randnumber1").className="tx3";
                    document.getElementById("randnumber1").disabled=false;
                    document.getElementById("sp_random").style.display="none";
                    document.getElementById("randpic").style.display="";
                    refreshImg();
                }
                else{
                    document.getElementById("hid_flag").value="1";
                    document.getElementById("randnumber1").disabled=true;
                    document.getElementById("randnumber1").className="tx3 txDisable";
                    document.getElementById("sp_random").style.display="";
                    document.getElementById("randpic").style.display="none";
                }

                reloadScript("kingo_encypt",_webRootPath+"custom/js/SetKingoEncypt.jsp");
                if("407" == status || "410" == status){
                    alert(message);
                    showMessage(message);
                }
                else{
                    showMessage(message);
                }
                jQuery("#login").attr("disabled", false);
                //jQuery("#reset").attr("disabled", false);

                if ("401"==status) {
                    jQuery("#randnumber").val("");
                    jQuery("#randnumber").focus();
                } else {
                    jQuery("#username").val("");
                    jQuery("#password").val("");
                    jQuery("#randnumber").val("");
                    document.getElementById("hid_dxyzm").value="";
                    jQuery("#username").focus();
                }
			}
		}
	}
}

function isPasswordPolicy(username, password){
	if (password == "" || password == null || username == password){
		return "0" ;
	}
	var passwordlen = new String(password).length ;
	if (passwordlen < 6){
		return "0" ;
	}
	return "1" ;
}

function doAjax(url, params, callback, async, precallback) {
	var isAsync = true;
	if (async){ 
		isAsync = async;
	} else {
		isAsync = true;
	}
	jQuery.ajax({
		type: "POST",
		url: url,
		data: params, 
		dataType: "text",
		beforeSend: function() { 
				if (precallback) { 
					precallback();
				}  
			},	
		async: isAsync,
		success: callback
	})		
} 

function validate() {
	var username = jQuery("#username").val();
	var password = jQuery("#password").val();
	var randnumber = jQuery("#randnumber").val();
	var flag=jQuery("#hid_flag").val();
	if (isNull(username)) {
		showMessage("请输入账号!");
		jQuery("#yhmc").focus();
		return false;
	}
	if (isNull(password)) {
		showMessage("请输入密码!");
		jQuery("#password").focus();
		return false;
	}
	else if(password.length>30){
        showMessage("密码不能超过30位!");
        jQuery("#password").focus();
        return false;
	}
	/*
	if (isNull(randnumber)) {
	    randnumber="0000";
	}
	*/
	if (isNull(randnumber) && flag!="1") {
		showMessage("请输入验证码!");
		jQuery("#randnumber").focus();
		return false;
	}
	return true;
}

/**
 * 判断某个变量值是否为空值
 * 
 */
function isNull(initValue){
	if (initValue == null || initValue.length == 0) {
		return true;
	} else {
		return false;
	}
}

function showMessage(message){
	document.getElementById("msg").innerHTML = message;
	setTimeout("document.getElementById('msg').innerHTML='';",20000);
}

function dosubmit(){
	document.getElementById("dosub").submit();
}

function findpwd(){
	var top=(window.screen.height-50-780)/2;
	var left=(window.screen.width-10-520)/2;
	var tourl = _webRootPath + "frame/retrievePassword.v2.jsp" ;
	window.document.location.href = tourl ;
	//window.open(tourl, "", "width=780,height=520,top="+top+",left="+left+",resizable=no,scrollbars=no,status=no,toolbar=no,menubar=no,location=no");
	//window.open("retrievePassword.v2.jsp","","width=350,height=240",null);
	//window.open("kingosoft/password/validate.jsp","","width=350,height=240",null);
}


function updatepwd(){
	window.showModalDialog('kingosoft/password/pwd_ldap.html',"","dialogWidth:350px;dialogHeight:220px;");
	refreshImg();
}

function gologin(e , obj){
	var e = window.event?window.event:e;
	var x=e.keyCode;
	if(x!=13) return false;
	if(x<48||x>57) e.returnValue=false;
	obj.select();
	document.getElementById("login").onclick();
}

function changelogin1(){
	document.getElementById("loginImg").src=_webRootPath+"frame/themes/kingo/images/4.png";
	document.getElementById("loginImg1").src=_webRootPath+"frame/themes/kingo/images/3.png"
	jQuery("#login-info-div").hide();
	jQuery("#login-info-div1").slideDown(500);
	
}
function changelogin(){
	document.getElementById("loginImg").src=_webRootPath+"frame/themes/kingo/images/1.png";
	document.getElementById("loginImg1").src=_webRootPath+"frame/themes/kingo/images/5.png"
	jQuery("#login-info-div1").hide();
	jQuery("#login-info-div").slideDown(500);
	scanflag=false;
}

function loginmouseover(){
	document.getElementById("login").style.backgroundImage="url("+_webRootPath+"frame/themes/"+modename+"/images/login.png)";
}

function loginmouseout(){
	document.getElementById("login").style.backgroundImage="url("+_webRootPath+"frame/themes/"+modename+"/images/login_1.png)";
}

function img1over(){document.getElementById("img1").src="themes/kingo/images/benke2.png";}
function img2over(){document.getElementById("img2").src="themes/kingo/images/gaozhi2.png";}
function img3over(){document.getElementById("img3").src="themes/kingo/images/zhongzhi1.png";}
function img4over(){document.getElementById("img4").src="themes/kingo/images/zhongxiaoxue1.png";}
function img5over(){document.getElementById("img5").src="themes/kingo/images/youeryuan1.png";}
function img1out(){document.getElementById("img1").src="themes/kingo/images/benke.png";}
function img2out(){document.getElementById("img2").src="themes/kingo/images/gaozhi.png";}
function img3out(){document.getElementById("img3").src="themes/kingo/images/zhongzhi.png";}
function img4out(){document.getElementById("img4").src="themes/kingo/images/zhongxiaoxue.png";}
function img5out(){document.getElementById("img5").src="themes/kingo/images/youeryuan.png";}

function logininover(){
	document.getElementById("img_login").src="themes/kingo/images/loginin1.png";
}

function logininout(){
	document.getElementById("img_login").src="themes/kingo/images/loginin2.png";
}

/**
* 刷新验证码
*/			
var click_yzm = "0";
function refreshImg(flag){
	if (flag=="1"){
		// 通过点击生成验证码
		click_yzm = "1";
	} else {
		// 焦点定位生成验证码时已点击生成，忽略该次验证码生成
		if (click_yzm == "1"){
			//click_yzm = "0";
			return ;
		}
	}
	document.getElementById("randpic").style.display="";
	jQuery(".div_random>img").css("display","");
	var url = _webRootPath + "cas/genValidateCode?v="+Math.floor(Math.random()*100+1);
	document.getElementById("randpic").src = url ;
}

//通过手机验证码重置密码
function doMobileReset2(){
   var tourl = _webRootPath + "frame/retrievePassword_one.jsp" ;
   //window.document.location.href = tourl ;
   var _json = {"_title":"重置密码"};
   _json._width = "770px";
   _json._height = "316px";
   _json._isMove = true;
   var cKWindow = new CKWindow(_json);
   cKWindow.setSrc(tourl,"770px","100%");
   cKWindow.openWindow(_json);
}
function doMobileReset(){
    var theURL=_webRootPath + "frame/retrievePassword_one.jsp" ;
	ymPrompt.win({message:theURL,width:1010, height:310,title:"重置密码",handler:doHanler,maxBtn:false,minBtn:false,closeBtn:true,iframe:true});
}
function doHanler(tp){
			
}
function doMobileYzm(sjhm){
    document.getElementById("hid_sjhm").value=sjhm;
    var theURL=_webRootPath + "frame/LoginBar_Message.jsp" ;
    ymPrompt.win({message:theURL,width:810, height:140,title:"输入手机短信验证码",handler:doHanler2,maxBtn:false,minBtn:false,closeBtn:false,iframe:true});
}
function doHanler2(tp){

}
function CloseWin(){
    ymPrompt.doHandler('close');
}
function CloseWin2(){
    ymPrompt.doHandler('close');
    window.document.location.href = _webRootPath ;
}
function checkpwd(oInput){
      var pwd = oInput.value;
      if(pwd!=""){
          document.getElementById("lbl_img").style.display="";
	  }
      var result = 0;
      for(var i = 0, len = pwd.length; i < len; ++i)
      {
      	result |= charType(pwd.charCodeAt(i));
      }
      document.getElementById("txt_mm_expression").value = result;  //密码规则
      document.getElementById("txt_mm_length").value = pwd.length; //密码长度
     
      var userzh = document.getElementById("username").value; //取账号

      var inuserzh = "0";
      
      if( pwd.toLowerCase().trim().indexOf(userzh.toLowerCase().trim()) > -1)
      {
      	inuserzh = "1";
      }
      document.getElementById("txt_mm_userzh").value = inuserzh;  //判断密码是否包含账号
}
	        
function charType(num){
     if(num >= 48 && num <= 57)
     {
       return 8;
     }
     if (num >= 97 && num <= 122)
     {
       return 4;
     }
     if (num >= 65 && num <= 90)
     {
       return 2;
     }
     return 1;
}

/**
 * 去掉左边(开始)的空白字符
 * @param string
 * @return
 */
String.prototype.trimStart=function(string)
{
    if (!string)
    {
        string="\\s+";
    }
    var trimStartPattern=new RegExp("^("+string+")+","g");
    return this.replace(trimStartPattern,"");
}

/**
 * 去掉右边(结尾)的空白字符
 * @param string
 * @return
 */
String.prototype.trimEnd=function(string)
{
    if (!string)
    {
        string="\\s+";
    }
    var trimEndPattern=new RegExp("("+string+")+$","g");
    return this.replace(trimEndPattern,"");
}

/**
 * 去掉首尾空白字符
 * @param string
 * @return
 */
String.prototype.trim=function(string)
{
    return this.trimStart(string).trimEnd(string);
}		
