define(['postmonger'], function (Postmonger) {
    'use strict';

    var connection = new Postmonger.Session();
    var payload = {};
    var journeys = [];
    var currentApiEventKey = null;

    $(window).ready(onRender);
    connection.on('initActivity', initialize);
    connection.on('clickedNext', save);
    connection.on('requestedSchema', function(data) {
        payload['arguments'] = payload['arguments'] || {};
        payload['arguments'].execute = payload['arguments'].execute || {};
        payload['arguments'].execute.inArguments = payload['arguments'].execute.inArguments || [];
        payload['arguments'].execute.inArguments[0] = payload['arguments'].execute.inArguments[0] || {};
        payload['arguments'].execute.inArguments[0].schema = data['schema'];
    });

    function onRender() {
        connection.trigger('ready');
        connection.trigger('requestTokens');
        connection.trigger('requestEndpoints');
    }

    connection.trigger('requestTriggerEventDefinition');
    connection.on('requestedTriggerEventDefinition', function (eventDefinitionModel) {
        if (eventDefinitionModel) {
            currentApiEventKey = eventDefinitionModel.eventDefinitionKey;
        }
    });

    function initialize(data) {
        if (data) {
            payload = data;
        }

        var hasInArguments = Boolean(
            payload.arguments &&
            payload.arguments.execute &&
            payload.arguments.execute.inArguments &&
            payload.arguments.execute.inArguments.length > 0
        );

        var inArguments = hasInArguments ? payload.arguments.execute.inArguments : [];

        var selectedJourneyId = null;
        if (inArguments.length > 0) {
            selectedJourneyId = inArguments[0].selectedJourneyId;
        }

        connection.trigger('requestSchema');
        fetchJourneys(selectedJourneyId);
    }

    function save() {
        var selectedJourneyId = $('input[name="journey"]:checked').val();
        var selectedJourney = journeys.find(j => j.id === selectedJourneyId);

        if (selectedJourney) {
            payload.arguments.execute.inArguments = [
                {
                    contactKey: '{{Contact.Key}}',
                    selectedJourneyId: selectedJourney.id,
                    payload: schema
                }
            ];
        }

        payload.metaData.isConfigured = true;
        connection.trigger('updateActivity', payload);
    }

    function fetchJourneys(selectedJourneyId = null) {
        $.ajax({
            url: '/journeys',
            type: 'GET',
            beforeSend: function() {
                $('#loading-message').show();
                $('#journey-checkboxes').hide();
            },
            success: function (response) {
                journeys = response.items.filter(journey => {
                    if (journey.defaults && journey.defaults.email) {
                        let apiEventEmail = journey.defaults.email.find(email => email.includes('APIEvent'));
                        if (apiEventEmail) {
                            let apiEventKey = apiEventEmail.match(/APIEvent-([a-z0-9-]+)/)[0];
                            return apiEventKey !== currentApiEventKey;
                        }
                    }
                    return false;
                });

                if (journeys.length === 0) {
                    $('#loading-message').text('No journeys with API Event entry source was found.');
                } else {
                    populateJourneys(journeys, selectedJourneyId);
                    $('#loading-message').hide();
                    $('#journey-checkboxes').show();
                }
            },
            error: function (xhr, status, error) {
                console.error('Error fetching journeys:', error);
                $('#loading-message').text('Error loading journeys. Please try again.');
            }
        });
    }

    function populateJourneys(journeys, selectedJourneyId = null) {
        var $checkboxGroup = $('#journey-checkboxes');
        $checkboxGroup.empty();
        $checkboxGroup.append('<label>Select Journeys to Monitor:</label>');

        journeys.forEach(function (journey) {
            var apiEventKey = journey.defaults.email.find(email => email.includes('APIEvent')).match(/APIEvent-([a-z0-9-]+)/)[0];
            var $checkbox = $('<input>', {
                type: 'checkbox',
                name: 'journey',
                value: journey.id,
                'data-api-event-key': apiEventKey
            });

            if (journey.id === selectedJourneyId) {
                $checkbox.prop('checked', true);
            }

            $checkboxGroup.append(
                $('<label>', {
                    text: journey.name
                }).prepend($checkbox)
            );
        });
    }
});
