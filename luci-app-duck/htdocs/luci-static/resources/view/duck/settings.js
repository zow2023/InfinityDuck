// SPDX-License-Identifier: Apache-2.0
'use strict';
'require form';
'require poll';
'require rpc';
'require uci';
'require view';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

var callFileRead = rpc.declare({
	object: 'file',
	method: 'read',
	params: ['path'],
	expect: { data: '' }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('duck'), {}).then(function (res) {
		var isRunning = false;
		try {
			isRunning = res['duck']['instances']['duck']['running'];
		} catch (e) { }
		return isRunning;
	});
}

// 缓存 PID，避免每次 poll 都重复读 pid 文件
var cachedPid = null;

function getMemoryUsage() {
	// 有缓存 PID 时，直接读 status，只需一次 RPC
	if (cachedPid) {
		return L.resolveDefault(callFileRead('/proc/' + cachedPid + '/status'), '').then(function (status) {
			var match = (status || '').match(/VmRSS:\s+(\d+)\s+kB/);
			if (!match) {
				// PID 已失效（服务重启），清除缓存下次重新读
				cachedPid = null;
				return '';
			}
			return (parseInt(match[1]) / 1024).toFixed(1) + ' MB';
		});
	}
	// 无缓存时，先读 pid 文件
	return L.resolveDefault(callFileRead('/var/run/dae.pid'), '').then(function (pid) {
		pid = (pid || '').trim();
		if (!pid) return '';
		cachedPid = pid;
		return L.resolveDefault(callFileRead('/proc/' + pid + '/status'), '').then(function (status) {
			var match = (status || '').match(/VmRSS:\s+(\d+)\s+kB/);
			return match ? (parseInt(match[1]) / 1024).toFixed(1) + ' MB' : '';
		});
	});
}

function renderStatus(isRunning, memory) {
	var renderHTML;
	if (isRunning) {
		renderHTML = '<em style="color:green"><b>' +
			_('InfinityDuck') + ' ' + _('RUNNING') +
			'</b></em>';
		if (memory) {
			renderHTML += ' <span style="color:#666; font-size:0.9em;">(' +
				_('Memory Usage') + ': ' + memory +
				')</span>';
		}
	} else {
		renderHTML = '<em style="color:red"><b>' +
			_('InfinityDuck') + ' ' + _('NOT RUNNING') +
			'</b></em>';
	}
	return renderHTML;
}

// 抽取为独立函数，供立即执行和 poll 共用
function updateStatus() {
	return Promise.all([
		L.resolveDefault(getServiceStatus()),
		L.resolveDefault(getMemoryUsage())
	]).then(function (results) {
		var el = document.getElementById('service_status');
		if (el)
			el.innerHTML = renderStatus(results[0], results[1]);
	});
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('duck')
		]);
	},

	render: function (data) {
		var m, s, o;

		m = new form.Map('duck', _('InfinityDuck'),
			_('eBPF-based Linux high-performance transparent proxy solution.'));

		s = m.section(form.TypedSection);
		s.anonymous = true;
		s.render = function () {
			// 立即执行一次，不等 poll 第一个周期
			updateStatus();
			// 之后每 5 秒轮询
			poll.add(updateStatus, 5);

			return E('div', { class: 'cbi-section', id: 'status_bar' }, [
				E('p', { id: 'service_status' }, _('Collecting data…'))
			]);
		};

		s = m.section(form.NamedSection, 'config', 'duck');

		o = s.option(form.Flag, 'enabled', _('Enable'));

		o = s.option(form.Flag, 'scheduled_restart', _('Scheduled Restart'));
		o.rmempty = false;

		o = s.option(form.Value, 'cron_expression', _('Cron Expression'));
		o.depends('scheduled_restart', '1');
		o.placeholder = '0 4 * * *';
		o.rmempty = true;

		o = s.option(form.Value, 'delay', _('Startup Delay'),
			_('Startup delay in seconds.'));
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.default = '0';

		o = s.option(form.Value, 'config_file', _('Configration file'));
		o.default = '/etc/duck/config.dae';
		o.rmempty = false;
		o.readonly = true;

		o = s.option(form.Flag, 'subscribe_enabled', _('Enable Subscription Download'));
		o.rmempty = false;

		o = s.option(form.Value, 'subscribe_url', _('Subscription URL'),
			_('The URL to download configuration from when starting/restarting. Will use existing config if download fails.'));
		o.depends('subscribe_enabled', '1');
		o.rmempty = true;

		o = s.option(form.Value, 'log_maxbackups', _('Max log backups'),
			_('The maximum number of old log files to retain.'));
		o.datatype = 'uinteger';
		o.placeholder = '1';

		o = s.option(form.Value, 'log_maxsize', _('Max log size'),
			_('The maximum size in megabytes of the log file before it gets rotated.'));
		o.datatype = 'uinteger';
		o.placeholder = '1';

		return m.render();
	}
});
