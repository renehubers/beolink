package Slim::Plugin::Beolink::Settings;

# SqueezeCenter Copyright 2001-2007 Logitech.
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License, 
# version 2.

use strict;
use base qw(Slim::Web::Settings);

use Slim::Utils::Prefs;

my $prefs = preferences('plugin.beolink');

#$prefs->setValidate({ 'validator' => 'intlimit', 'low' => 1024, 'high' => 65535 }, 'cliport');
#$prefs->setChange(\&Slim::Plugin::CLI::Plugin::cli_socket_change, 'cliport');

sub name {
	return Slim::Web::HTTP::protectName('PLUGIN_BEOLINK');
}

sub page {
	return Slim::Web::HTTP::protectURI('plugins/Beolink/settings/basic.html');
}

sub prefs {
	return ($prefs, qw(beolinkplayer));
}

1;

__END__
