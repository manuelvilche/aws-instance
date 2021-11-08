'use strict';

require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const logger = require('lllog')();

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: process.env.AWS_DEFAULT_REGION || 'us-east-1'});

const packageInfo = require('./package.json');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
	res.json({ version: packageInfo.version });
});

app.post('/restart-instance', async (req, res) => {

	const { instanceId, hash } = req.body;
	console.log('body:', req.body);

	if(!process.env.HASH || process.env.HASH !== hash)
		return res.status(403).send('Invalid credentials');

	if(!instanceId)
		return res.status(400).send('You most send the instanceId');

	logger.info('sin errores');
	// Create EC2 service object
	var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
	logger.info(ec2);

	var params = {
		InstanceIds: [instanceId]
	};

	logger.info(params);
	// Call EC2 to reboot instances
	ec2.rebootInstances(params, function(err, data) {
		console.log('err:', err);
		console.log('data:', data);
		if(err && err.code === 'DryRunOperation') {
			logger.info(params);
			params.DryRun = false;
			ec2.rebootInstances(params, function(err, data) {
				logger.info(data);
				if(err)
					console.log("Error", err);
				else if (data) {
					logger.info('data:', data);
					res.json(`instanceId: ${instanceId} restarted`);
				}

			});
		} else
			console.log("You don't have permission to reboot instances.");
	});


});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
	console.log(`Our app is running on port ${PORT}`);
});
