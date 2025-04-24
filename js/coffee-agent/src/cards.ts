import { Card, ChoiceSetInput, Container, Fact, FactSet, SubmitAction, TaskFetchAction, TextBlock, TextInput } from "@microsoft/teams.cards";
import { CoffeeOrder } from "./interfaces";

/**
 * Generates an activity with an adaptive card for the coffee order.
 * @param order - The coffee order object containing the order details.
 * @returns The activity object containing the adaptive card for the coffee order.
 */
function generateOrderCard(order: CoffeeOrder): any {
  const card = new Card();
  card.version = '1.5';
  card.body = [
    new TextBlock(`☕ Today's Coffee Order #${order.id}`, { weight: 'bolder', size: 'large' }),
    new TextBlock(`📍 Today's Cafe: ${order.coffeeShop.name}`, { spacing: 'medium' }),
    new TextBlock("🥤 Available Drinks:", { spacing: 'medium' })
  ]; 

  const drinkContainer = _getDrinkContainer(order);
  card.body.push(drinkContainer);

  card.body.push(new TextBlock("📋 Current Order:", { weight: 'bolder', spacing: 'medium' }));
  const factSet = _getCurrentOrders(order);
  card.body.push(factSet);

  card.body.push(new TextBlock(`🕓 Status: ${order.status}`, { spacing: 'medium' }));

  card.actions = [
    new TaskFetchAction().withTitle("Submit Your Order").withId("addOrderButton")
  ];

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: card, 
      },
    ],
  };
}

/**
 * Generates an activity with an adaptive card for the updated coffee order.
 * @param order - The coffee order object containing the order details.
 * @returns The activity object containing the updated adaptive card for the submitted coffee order.
 */
function generateSubmittedOrderCard(order: CoffeeOrder): any {
  const card = new Card();
  card.version = '1.5';
  card.body = [
    new TextBlock(`☕ Submitted Coffee Order #${order.id}`, { weight: 'bolder', size: 'large' }),
    new TextBlock(`📍 Today's Cafe: ${order.coffeeShop.name}`, { spacing: 'medium' }),
    new TextBlock("🥤 Available Drinks:", { weight: 'bolder', spacing: 'medium' })
  ];
  
  const drinkContainer = _getDrinkContainer(order);
  card.body.push(drinkContainer);

  card.body.push(new TextBlock("📋 Current Order:", { weight: 'bolder', spacing: 'medium' }));
  const factSet = _getCurrentOrders(order);
  card.body.push(factSet);

  card.body.push(new TextBlock(`🕓 Status: ${order.status}`, { spacing: 'medium' }));

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: card, 
      },
    ],
  };
}

function _getDrinkContainer(order: CoffeeOrder): Container {
  const drinkContainer = new Container();
  drinkContainer.items = [];

  order.coffeeShop.drinks.forEach(drink => {
    drinkContainer.items.push(new TextBlock(`- ${drink.name} (${drink.size})`, { wrap: true }));
  });

  return drinkContainer;
}

function _getCurrentOrders(order: CoffeeOrder): FactSet {
  const factSet = new FactSet().withOptions({ spacing: 'medium' });
  let facts: Fact[] = [];
  facts = Array.from(order.drinks.entries()).map(([member, drink]) => {
    const memberName = member.name;
    const drinkInfo = `${drink.name} (${drink.size})`;
    return new Fact(memberName, drinkInfo);
  });

  factSet.addFacts(...facts);
  return factSet;
}

/**
 * Generates the order dialog card for the coffee order.
 * @param order - The coffee order object containing the order details.
 * @returns A card object representing the order dialog.
 */
function generateOrderDialogCard(order: CoffeeOrder): Card {
    const card = new Card();
    card.version = '1.5';
    card.body = [new TextBlock("Your Name:", { weight: 'bolder' })];

    const nameInput = new TextInput(); 
    nameInput.id = "userNameInput";
    nameInput.placeholder = "Enter your name";
    card.body.push(nameInput); 

    card.body.push(new TextBlock("Select Your Drink:", { weight: 'bolder', spacing: 'medium' }));
    const drinkChoices = order.coffeeShop.drinks.map(drink => ({
        title: `${drink.name} (${drink.size})`, 
        value: `${drink.name} (${drink.size})`  
    }));
    
    const drinkInput = new ChoiceSetInput(); 
    drinkInput.id = "selectedDrinkInput";
    drinkInput.style = 'compact';

    drinkInput.choices = drinkChoices.map(choice => ({ title: choice.title, value: choice.value })); 
    card.body.push(drinkInput); 

    card.actions = [
        new SubmitAction().withTitle("Submit Your Order").withId("submitOrderButton") 
    ];

    return card;
}

export {
  generateOrderCard,
  generateSubmittedOrderCard,
  generateOrderDialogCard,
};
