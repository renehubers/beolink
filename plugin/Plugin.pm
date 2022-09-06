package Plugins::Beolink::Plugin;

# SqueezeCenter Copyright 2001-2007 Logitech.
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License,
# version 2.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
#
# beolink Protocol Support Plugin for SqueezeCenter

use strict;
use IO::Socket;
use Symbol;
use Scalar::Util qw(blessed);
use Time::HiRes;
use POSIX;
#use Slim::Plugin::Beolink::Settings;

use Slim::Music::Info;
use Slim::Utils::Log;
use Slim::Utils::Misc;
use Slim::Utils::Network;
use Slim::Utils::Prefs;
use Slim::Utils::Timers;
use Slim::Player::Source;

my $playlistdir;
my $beolinkplayer;
my $numbers= '';
my $lastirtime= 0;
my $lastbutton= '';
my $prefs= preferences('server');
my $log = Slim::Utils::Log->addLogCategory({
	'category'     => 'plugin.beolink',
	'defaultLevel' => 'ERROR',
	'description'  => getDisplayName(),
});
my $prefs = preferences('plugin.beolink');
my $prefsServer = preferences('server');
my $source= "";
my $oldsource= "";
my %state= ();

################################################################################
# PLUGIN CODE
################################################################################

# plugin: initialize xPL support
sub initPlugin {
	$log->error("start init beolink plugin...");
	#Slim::Plugin::Beolink::Settings->new;
	$beolinkplayer= $prefs->get('beolinkplayer') || "b8:27:eb:91:ca:60";
	$playlistdir= $prefsServer->get('playlistdir');
	Slim::Control::Request::addDispatch(['beolink', 'command', '_code'], [0, 0, 1, \&cliCommand]);
	$log->error("end init beolink plugin...");
}

sub shutdownPlugin {
	$log->info("shutdown beolink plugin...");
}

# plugin: name of our plugin
sub getDisplayName {
	return 'PLUGIN_BEOLINK';
}

sub enabled {
	return (1);
}

# Processes an incoming beolink message
sub cliCommand {
	my $request = shift;
	if ($request->isNotCommand([['beolink'], ['command']])) {
		$request->setStatusBadDispatch();
		return;
	}
	Slim::Utils::Timers::killTimers( undef, \&go );
	my $button = $request->getParam('_code');
	$log->error("beolink::command($button)");
	#handle_button(recode($button,Time::HiRes::time()));
	handle_button($button);
}
sub go {
	handle_button(recode("go",Time::HiRes::time()));
}
sub recode {
	my ($button,$irtime)= @_;
	my $diff= $irtime-$lastirtime;
	my $newbutton= $button;
	
	$newbutton= "$1+$button" if $lastbutton =~ /^(go|red|green|yellow|blue)$/ && $diff < 1.7;

	if ($button =~ /[0-9]$/ ) {
		$numbers.= $newbutton;
		$newbutton= undef;
		Slim::Utils::Timers::setTimer( undef, Time::HiRes::time() + 1.7, \&go );
	}
	elsif ($button eq 'go' && $numbers ne '' ) {
		$newbutton= $numbers;
		$numbers= '';
	}
	$lastbutton= $button;
	$lastirtime= $irtime;
	return $newbutton;
}

sub handle_button {
	my ($button)= @_;
	return unless defined $button;
	my $mode= mode();
	
	$log->error("handle_button: $button ($mode)");

	#$source= 'N.RADIO' if $button=~ /(radio|n\.radio)/;
	$source= uc($button) if $button=~ /(a\.tape|a\.tape2|cd|a\.aux|n\.music|phono|radio|n\.radio)/;
	if ($oldsource ne $source) {
		save($oldsource,($oldsource eq'RADIO'?0:1)) if $oldsource;
		restore($source);
		$oldsource= $source;
	}
	Slim::Control::Stdio::executeCmd("$beolinkplayer playlist play") if $button=~ /(radio|phono|n\.radio|a\.tape|a\.tape2|cd|a\.aux|n\.music)/;
	
	if ($button =~ /^(go|radio|phono|n\.radio|a\.tape|a\.tape2|cd|a\.aux|n\.music)$/) {
		beolinkExecuteCmd("power 1", $beolinkplayer) if !power();
		beolinkExecuteCmd("play",$beolinkplayer);
	}
	elsif ($button =~ /stop$/ ) {
		beolinkExecuteCmd(($mode eq 'play' ? "pause" : "play"),$beolinkplayer);
	}
	elsif ($button =~ /up$/) {
		#beolinkExecuteCmd("playlist jump +1",$beolinkplayer);
		beolinkExecuteCmd(sprintf("playlist jump %d",currentindex()+1), $beolinkplayer);
	}
	elsif ($button =~ /down$/) {
		#beolinkExecuteCmd("playlist jump -1",$beolinkplayer);
		beolinkExecuteCmd(sprintf("playlist jump %d",currentindex()-1), $beolinkplayer);
	}
	elsif ($button =~ /^(\d+)$/ ) {
		beolinkExecuteCmd(sprintf("playlist jump %d",$button-1),$beolinkplayer);
	}
	elsif ($button =~ /std.by$/ ) {
		#beolinkExecuteCmd("pause",$beolinkplayer) if $mode eq 'play';
		beolinkExecuteCmd("power 0",$beolinkplayer);
	}
	elsif ($button =~ /right$/) {
		beolinkExecuteCmd("time +5",$beolinkplayer);
	}
	elsif ($button =~ /left$/) {
		beolinkExecuteCmd("time -5",$beolinkplayer);
	}
	elsif ($button =~ /^(go|red|green|yellow|blue)\+(\d+)$/ ) {
		my $num= $2;
		my $prefix= ($1 eq 'go'?'':substr($1,0,1));
		my $pl= playlist(sprintf("%s%03d",$prefix,$num));
		beolinkExecuteCmd("playlist play $pl",$beolinkplayer) if $pl;
	}
	elsif ($button =~ /^(red|green|yellow|blue)$/ ) {
		my $pl= playlist(sprintf("%s_%s", $source, $button));
		$pl= playlist($button) if !$pl;
		beolinkExecuteCmd("playlist play $pl",$beolinkplayer) if $pl;
	}
}

sub playlist {
	my ($search)= @_;
	opendir(DIR,$playlistdir);
	my @pl= grep { /^$search/i && /\.m3u$/ } readdir(DIR);
	closedir DIR;
	$log->error("playlist $search: %s", $pl[0]||'');
	if (@pl) {
		my $pl= $playlistdir . "/" .shift @pl;
		$pl=~ s/([^a-zA-Z0-9_.%;&?\/\\:+=~-])/uc sprintf("%%%02x",ord($1))/eg;
		return $pl;
	}
	return undef;
}

sub beolinkExecuteCmd {
	my @clients = Slim::Player::Client::clients();
	my $clientid;

	# If client ID is undefined, send to all players
	if (!defined($_[1])) {

		foreach my $client (@clients) {
			$clientid = $client->id();
			Slim::Control::Stdio::executeCmd("$clientid $_[0]");
		}

	} else {
		Slim::Control::Stdio::executeCmd("$_[1] $_[0]");
	}
}

# This routine is called by Slim::Command::execute() for each command it processes.
sub beolinkExecuteCallback {
}

sub mode {
	my @clients = Slim::Player::Client::clients();
	foreach my $client (@clients) {
		return (Slim::Player::Source::playmode($client)) if $client->id() eq $beolinkplayer;
	}
	return '';
}
sub power {
	my @clients = Slim::Player::Client::clients();
	foreach my $client (@clients) {
		return ($client->power() eq 'on') if $client->id() eq $beolinkplayer;
	}
	return 0;
}
sub current {
	my @clients = Slim::Player::Client::clients();
	foreach my $client (@clients) {
		if ($client->id() eq $beolinkplayer) {
			my $song= Slim::Player::Playlist::song($client);
			return $song->url if defined $song;
		}
	}
	return '';
}

sub urlencode {
	my ($s)= shift;
	$s=~ s/([^a-zA-Z0-9_.%;&?\/\\:+=~-])/uc sprintf("%%%02x",ord($1))/eg;
	return $s;
}

sub save {
	my ($s,$save)= @_;
	#$state{$s}{mode}= Slim::Control::Stdio::executeCmd("$beolinkplayer mode ?");
	$state{$s}{mode}= mode();
	$state{$s}{index}= Slim::Control::Stdio::executeCmd("$beolinkplayer playlist index ?");
	$state{$s}{time}= Slim::Control::Stdio::executeCmd("$beolinkplayer time ?");
	Slim::Control::Stdio::executeCmd("$beolinkplayer playlist save $s") if $save;
	$log->error("state $s/$save saved: $state{$s}{mode} | $state{$s}{index} | $state{$s}{time}");
}
sub restore {
	my ($s)= shift;
	Slim::Control::Stdio::executeCmd("$beolinkplayer playlist load $s");
	return unless defined $state{$s};
	Slim::Control::Stdio::executeCmd($state{$s}{index});
	Slim::Control::Stdio::executeCmd($state{$s}{time});
	#Slim::Control::Stdio::executeCmd("$beolinkplayer playlist play");
	$log->error("state $s restored: $state{$s}->{mode} | $state{$s}->{index} | $state{$s}->{time}");
}
sub currentindex {
	my $response= Slim::Control::Stdio::executeCmd("$beolinkplayer playlist index ?");
	my $index= $response=~ /(\d+)$/?$1:-1;
	$log->error("index: $index");
	return $index;
}
1;
