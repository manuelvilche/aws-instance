'use strict';

require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const logger = require('lllog')();

// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');
// Set the region
AWS.config.update({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

const packageInfo = require('./package.json');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
	res.json({ version: packageInfo.version });
});

const updateDNS = async (instanceId, ec2, retries = 0) => {

	console.log('getting ip address');

	return new Promise((resolve, reject) => {

		return ec2.describeInstances({ InstanceIds: [instanceId] }, async (err, data) => {

			if(err)
				console.log(err);

			const ip = data.Reservations[0].Instances[0].PublicIpAddress;

			console.log('ip:', ip);

			if(retries >= 3) {
				console.log('too match tries');
				resolve();
			}

			if(!ip) {
				retries++;
				console.log(`retry: ${retries}`);

				console.log('sleeping for 5 seconds');
				await new Promise(resolve => setTimeout(resolve, 5000));
				await updateDNS(instanceId, ec2, retries);
			}

			console.log('PublicIpAddress:', data.Reservations[0].Instances[0].PublicIpAddress);
			resolve();
		});

	})
};

app.post('/restart-instance', async (req, res) => {

	const { instanceId, hash } = req.body;

	if(!process.env.HASH || process.env.HASH !== hash)
		return res.status(403).send('Invalid credentials');

	if(!instanceId)
		return res.status(400).send('You has to send the instanceId');

	// Create EC2 service object
	const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

	// Call EC2 to reboot instances
	const params = {
		InstanceIds: [instanceId]
	};

	ec2.rebootInstances(params, async (err, data) => {
		let message = 'restarted';

		if(err) {
			// console.log('Error', err);

			if(err.code === 'IncorrectState') {

				await ec2.startInstances(params, (startError, startData) => {

					if(startError)
						console.log('Error', startError);

					logger.info('CurrentState:', startData.StartingInstances[0].CurrentState.Name);
					logger.info('PreviousState:', startData.StartingInstances[0].PreviousState.Name);
					message = 'started';
				});
			}
		}

		await updateDNS(instanceId, ec2);

		return res.json(`instanceId: ${instanceId} ${message}`);
	});

});

app.post('/stop', async (req, res) => {

	const { instanceId, hash } = req.body;

	if(!process.env.HASH || process.env.HASH !== hash)
		return res.status(403).send('Invalid credentials');

	if(!instanceId)
		return res.status(400).send('You has to send the instanceId');

	// Create EC2 service object
	const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

	// Call EC2 to reboot instances
	ec2.stopInstances({ InstanceIds: [instanceId] }, (err, response) => {

		if(err)
			console.log('Error', err);

		logger.info('CurrentState:', response.StoppingInstances[0].CurrentState.Name);
		logger.info('PreviousState:', response.StoppingInstances[0].PreviousState.Name);
		res.json(`instanceId: ${instanceId} stopped`);
	});
});

app.post('/describe-instance', async (req, res) => {

	const { instanceId, hash } = req.body;

	if(!process.env.HASH || process.env.HASH !== hash)
		return res.status(403).send('Invalid credentials');

	if(!instanceId)
		return res.status(400).send('You has to send the instanceId');

	// Create EC2 service object
	const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

	// Call EC2 to describe instances
	ec2.describeInstances({ InstanceIds: [instanceId] }, (err, response) => {

		if(err)
			console.log('Error', err);

		res.json(response);
	});
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
	console.log(`Our app is running on port ${PORT}`);
});
